# AgriWeight Smart System

Full-stack application for the ESP32-based AgriWeight agricultural weighing machine.
React + Vite frontend, Node.js + Express backend, MongoDB Atlas database, live ESP32 telemetry over HTTP.

The web app has four tabs:

| Tab | Purpose |
|---|---|
| **Dashboard** | DB-backed totals (farmers, devices, assignments), live weight, hardware status, recent registrations |
| **Farmers** | Farmer registration, profiles, search, village filter, edit and delete |
| **Hardware** | Verify a registered Farmer ID, assign/unassign the weighing device |
| **History** | Per-farmer totals and paginated weighing records |

Farmer data is **not hardcoded anywhere**. The web app, the API and the ESP32 all use the same
MongoDB `farmers` collection as the single source of truth.

## Folder Structure

```
Project/
  AgriWeight_ESP32_Code/     ESP32 firmware (Arduino IDE)
    AgriWeight_all_components.ino
  frontend/                  React + Vite + Bootstrap dashboard
    src/
      api/client.js          Fetch wrapper for every API endpoint
      components/            Dashboard, Farmers, FarmerForm, FarmerDetail,
                             Hardware, History, Modal, Toast, ConfirmDialog, ...
      utils/validation.js    Client-side form validation
  backend/                   Express + Mongoose API
    src/
      config.js              Environment configuration
      db.js                  MongoDB connection (optional custom DNS resolvers)
      models/                Farmer, WeighingRecord, Device schemas
      routes/                farmers, devices, weighings, dashboard endpoints
      middleware/            hardware API-key auth, error handling
      utils/                 validators, serializers, money rounding, helpers
    .env                     Secrets (never commit / never share)
    .env.example             Template without secrets
```

## Prerequisites

- Node.js 18+ and npm
- A MongoDB Atlas cluster (or any MongoDB 6+ deployment)
- Arduino IDE for the ESP32 firmware

## Database Setup

1. Create a MongoDB Atlas cluster and a database user with read/write access.
2. Copy `backend/.env.example` to `backend/.env` and set:

   ```env
   PORT=5000
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/agriweigh?retryWrites=true&w=majority
   DEVICE_API_KEY=<shared secret used by the ESP32>
   DEFAULT_DEVICE_ID=AGRIWEIGHT-01
   OFFLINE_TIMEOUT_MS=45000
   # Optional — only needed when the local DNS resolver cannot resolve SRV records
   MONGODB_DNS_SERVERS=8.8.8.8,1.1.1.1
   ```

3. Collections are created automatically on first use: `farmers`, `devices`, `weighingrecords`.
4. Indexes are created at startup (`Promise.all([Farmer.init(), Device.init(), WeighingRecord.init()])`).
   This includes the **unique** `farmer_id` index and a **partial unique** index on `aadhaar_number`
   (uniqueness is enforced only when an Aadhaar is provided).
5. No farmer data is seeded. If an existing deployment already has farmers from earlier versions,
   they are shown as **Profile incomplete** until their name/mobile/village are filled in via
   **Farmers → Edit**.

Notes:

- `farmer_id` is stored as a string, uppercased, unique. New IDs are generated server-side
  (`/api/farmers/next-id`) as the highest numeric ID + 1, starting at `1000`.
- Weighing records are intentionally retained when a farmer is deleted (audit trail); the delete
  response reports how many records were kept and how many devices were released.

## Run Instructions

### Backend

```powershell
cd backend
npm install
npm start          # http://localhost:5000
```

Health check: `GET http://localhost:5000/api/health`.
The server exits if it cannot connect to MongoDB — check `MONGODB_URI` (and `MONGODB_DNS_SERVERS`)
in `backend/.env`.

### Frontend

```powershell
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Optional `frontend/.env` (see `.env.example`): `VITE_API_URL` (default `http://localhost:5000`)
and `VITE_DEVICE_ID` (default `AGRIWEIGHT-01`).

Production build: `npm run build`, then serve `dist/` with any static host and point
`VITE_API_URL` at the backend.

## Farmers Module

**Farmers tab** lists every registered farmer with Farmer ID, Full Name, Mobile Number, Village,
Aadhaar Number (masked), Registration Date, Status and weighing totals.

- **Add New Farmer** opens a registration form: Farmer ID (auto-generated, editable, digits only),
  Full Name, Mobile Number, Village, Aadhaar Number, Land Area (acres), Crop Type, Status, Address.
- **Validation** (client + server): Full Name is required; Mobile must be a 10-digit Indian number
  starting 6–9; Village is required; Aadhaar must be 12 digits; Land Area must be a number ≥ 0.
  Field errors are shown inline under the inputs.
- **Uniqueness:** duplicate Farmer ID and duplicate Aadhaar are rejected with `409 Conflict` and a
  message naming the existing farmer.
- **Farmer ID is immutable after creation** (weighing records reference it); create a new farmer
  instead.
- **Edit / View / Delete:** each row has view, edit and delete actions. Delete asks for confirmation,
  releases any assigned device, and keeps past weighing records for audit.
- **Search & filter:** real-time search across name, Farmer ID, mobile number and village, plus a
  village dropdown filter. Filters combine and can be cleared.
- **Responsive UI:** table on desktop, cards on mobile, loading skeletons, toast notifications,
  empty states and inline error banners.
- **Profile detail:** full profile, assigned device, weighing totals and paginated records.

## Hardware Validation Flow

1. The operator enters a Farmer ID in **Hardware → 1. Verify Farmer**.
2. The backend checks the `farmers` collection (`POST /api/farmers/verify`):
   - **Not registered** → `404` with `Invalid Farmer ID. Farmer is not registered.`
     Device assignment stays disabled; nothing is assigned.
   - **Registered** → `Farmer verified successfully.` and the UI auto-loads the farmer's name,
     village, mobile number, status, assigned device and saved record count.
3. The operator enters the Device ID and clicks **Assign Device to Farmer**
   (`POST /api/devices/:deviceId/assign`). Rules:
   - An unknown farmer is rejected before any assignment is written.
   - A device can be linked to only one farmer at a time.
   - A farmer already linked to another device must be unassigned first.
   - The Device ↔ Farmer mapping is stored on the `devices` document
     (`assigned_farmer_id`, `assigned_at`).
4. **Unassign** in the registered-devices list removes only the link; the device and farmer remain
   registered.

On the firmware side the hardcoded 10-farmer list was removed. The keypad only validates the
**format** (1–12 digits); the backend is the single source of truth. `POST /api/weighings` rejects
unregistered IDs with `422` and the message `Invalid Farmer ID. Farmer is not registered.`, and the
OLED shows `FARMER NOT REGISTERED`.

## ESP32 Firmware

Open `AgriWeight_ESP32_Code/AgriWeight_all_components/AgriWeight_all_components.ino` in Arduino IDE and check these settings before uploading:

| Setting | Location | Notes |
|---|---|---|
| `WIFI_NAME` / `WIFI_PASSWORD` | top of file | your Wi-Fi |
| `SERVER_HOST` | top of file | LAN IP of the computer running the backend, e.g. `http://192.168.1.10:5000` |
| `DEVICE_ID` | top of file | must match `DEFAULT_DEVICE_ID` in backend `.env` |
| `DEVICE_API_KEY` | top of file | must match `DEVICE_API_KEY` in backend `.env` |
| `calibrationFactor` | calibration section | load-cell calibration (existing value preserved) |

The device must be on the same network as the backend computer.

**Windows Firewall:** when the backend starts for the first time, Windows asks whether to allow Node.js — choose **Allow** on Private networks. If the ESP32 cannot reach the server, run PowerShell as Administrator:

```powershell
New-NetFirewallRule -DisplayName "AgriWeight Backend" -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow
```

## ESP32 Wiring (as delivered)

| Pin | Connection | Notes |
|---|---|---|
| 35 | ZERO / TARE button | external 10k pull-down, press = 3.3V |
| 34 | SAVE button | external 10k pull-down, press = 3.3V |
| 5 | ENTRY button (ID/price field select) | external 10k pull-down, press = 3.3V |
| 4 | MODE button (AUTO/MANUAL) | external 10k pull-down, press = 3.3V |
| 25, 26 | HX711 DOUT, SCK | load-cell amplifier |
| 21, 22 | OLED SDA, SCL | 0x3C, 128x64 |
| 13, 14, 18, 19 | Keypad rows | 4x4 keypad |
| 23, 27, 32, 33 | Keypad columns | 4x4 keypad |
| 2 | Red LED | button/save feedback |
| 12 | Buzzer | button/save feedback |

**Button wiring (important):** GPIO 34 and 35 are input-only pins with **no internal pull resistors** (software cannot enable any — verified against ESP-IDF docs). Each button must be wired as: one leg to 3.3 V, other leg to the GPIO, **plus a 10 kΩ resistor from the GPIO to GND (pull-down, parallel)**. Without the resistor the pin floats — presses are then random, stuck, or ignored. Pins 4 and 5 are normal GPIOs but use the same wiring for consistency.

## Hardware Behaviour

- **Telemetry:** ESP32 POSTs `net_weight_kg`, `mode`, `farmer_id`, `price_per_kg` to `POST /api/devices/telemetry` every 2 s. The dashboard marks the device **Online** only while this heartbeat arrives within `OFFLINE_TIMEOUT_MS` (default 45 s — generous so a slow hotspot never flaps the status; the device still flips Offline within a minute of actually losing contact).
- **AUTO mode:** saves one record per stable load; waits for the platform to be emptied before the next load; retries a failed save every 5 s while the load stays on.
- **MANUAL mode:** saves only when the SAVE button is pressed with a stable weight.
- **Duplicate protection:** every save carries a `record_key` derived from the start of the stable-weight period; retries after a network failure reuse the key, so the server never stores the same load twice.
- **Farmer validation:** the firmware no longer contains a farmer list; unregistered IDs are rejected by the backend with a clear OLED message.
- Zero/tare, keypad, OLED, buzzer and LED behaviour is unchanged from the original firmware.

## API

All responses use the envelope `{ "success": boolean, "data": ... }` or `{ "success": false, "error": { "message": "..." } }`.
Hardware endpoints require header `x-api-key: <DEVICE_API_KEY>`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server health check |
| GET | `/api/dashboard/stats` | Total/active farmers, registered/active/assigned devices, recent registrations |
| GET | `/api/farmers` | Farmer profiles + totals; optional `q` (name/ID/mobile/village), `village`, `status` |
| GET | `/api/farmers/next-id` | Next available unique numeric Farmer ID |
| POST | `/api/farmers/verify` | Verify a Farmer ID for hardware assignment (`farmerId`); never creates a farmer |
| POST | `/api/farmers` | Register a farmer; `farmerId` optional (generated). Rejects duplicate ID/Aadhaar with 409 |
| GET | `/api/farmers/:farmerId` | Full farmer profile (includes Aadhaar), assigned device and totals |
| PATCH | `/api/farmers/:farmerId` | Update profile; Farmer ID is immutable |
| DELETE | `/api/farmers/:farmerId` | Delete farmer, release devices, keep weighing records |
| GET | `/api/farmers/:farmerId/summary` | Farmer totals + latest price/kg |
| GET | `/api/farmers/:farmerId/records` | Paginated records (`page`, `limit`), newest first, per-farmer `recordNo` |
| GET | `/api/devices` | Registered devices with online state and farmer assignment |
| POST | `/api/devices/telemetry` | ESP32 heartbeat: `device_id`, `net_weight_kg`, `mode`, `farmer_id`, `price_per_kg` |
| POST | `/api/devices/:deviceId/assign` | Link device to a registered farmer (`farmerId`) |
| DELETE | `/api/devices/:deviceId/assign` | Unassign the device |
| GET | `/api/devices/:deviceId/status` | Online flag, last-seen, telemetry, farmer profile and latest record |
| POST | `/api/weighings` | Save a weighing: `farmer_id`, `weight_kg`, `price_per_kg`, optional `device_id`, `mode`, `record_key`. Rejects unregistered farmers with 422 |
| GET | `/api/weighings` | Recent records, optional `farmer_id`, `device_id`, `page`, `limit` |

Status codes: `400` invalid input, `404` unknown resource, `409` duplicate Farmer ID/Aadhaar,
`422` unregistered Farmer ID (hardware saves), `401` missing/incorrect API key on hardware routes.

Timestamps are stored in UTC (ISO 8601); the frontend displays them in IST (Asia/Kolkata).
Money is rounded to 2 decimals and weight to 3 decimals before storage and aggregation.
`crate_number` is `null` — the current hardware has no crate IDs, so the UI shows the documented weighing sequence number instead.

## Testing Summary (performed 14 Nov 2026)

- Farmer registration (server-generated and manual IDs): verified; new farmers persist across
  restarts and appear immediately in the list, History and Dashboard.
- Duplicate Farmer ID and duplicate Aadhaar: rejected with 409 and the correct message.
- Required-field and format validation on the form: verified (inline errors, no request sent).
- Search by name / Farmer ID / mobile, village filter and empty state: verified.
- Edit farmer: verified; Farmer ID is read-only; changing village updates filters correctly.
- Delete farmer: confirmation dialog, device release and retained-record count verified.
- Hardware validation: unknown ID → `Invalid Farmer ID. Farmer is not registered.`;
  registered ID → `Farmer verified successfully.` with auto-loaded name/village/mobile.
- Device assignment, duplicate-assignment guard and unassign: verified.
- Dashboard statistics and recent registrations: verified against Atlas data.
- Backend restart (index init + connection) and frontend production build: verified.

All QA farmers, the QA device and the QA weighing record created during testing were removed
afterwards; the database contains only real data.

## Hardware Notes

- All HTTP work (telemetry + save) runs on a dedicated FreeRTOS task pinned to core 0. The main loop (core 1) only reads buttons/keypad/HX711 and never blocks on the network, so every press registers immediately and the display stays smooth even while the server is unreachable.
- Saves are queued to the network task; a failed save retries with the same `record_key`, so the server never stores a duplicate.
- Hardware integration itself (HX711 readings, AUTO/MANUAL save on the actual device) was verified on the physical ESP32 only by the client — still do a final check with the real device before delivery.
- When the server is unreachable, telemetry slows down automatically (2 failed sends → 10 s interval) to keep Wi-Fi and the UI responsive.
- Weighing control stays on the hardware; the web app manages farmer master data and device assignment.

## Client Delivery Checklist

1. **Backend computer:** copy `backend/` to the client PC, create `backend/.env` from `.env.example` (real `MONGODB_URI` + matching `DEVICE_API_KEY`), then `npm install` and `npm start`.
2. **Farmers:** open the **Farmers** tab, register the real farmers, and note their Farmer IDs (or let the app generate them).
3. **Frontend:** `npm install` and `npm run dev` for development, or `npm run build` and host `dist/` statically with `VITE_API_URL` pointing at the backend.
4. **ESP32:** set `SERVER_HOST` to the backend PC's LAN IP (check `ipconfig`), set Wi-Fi credentials and `DEVICE_API_KEY`, then upload.
5. **Verify:** device shows Online on the Dashboard; verify a Farmer ID in **Hardware** and assign the device; save one weighing in each mode; confirm the farmer's totals in **History**.
6. When zipping the project for delivery, exclude `node_modules/`, `dist/` and `backend/.env`.

## Changed / Added Files

- `AgriWeight_ESP32_Code/AgriWeight_all_components/AgriWeight_all_components.ino` — removed the
  hardcoded farmer list, added format-only Farmer ID validation, telemetry heartbeat (with offline
  backoff), API key, `record_key` idempotency, save retry, error-specific status messages.
- `backend/src/models/Farmer.js` — full farmer profile, unique `farmer_id`, unique partial Aadhaar
  index, status, validation.
- `backend/src/routes/farmers.js` — CRUD, verify, next-id, summary and paginated records.
- `backend/src/routes/devices.js` — device list, assignment/unassignment, status.
- `backend/src/routes/dashboard.js` — DB-backed dashboard statistics.
- `backend/src/routes/weighings.js` — rejects unregistered Farmer IDs instead of auto-creating them.
- `backend/src/utils/validators.js`, `farmers.js`, `serializers.js` — shared validation, lookups and
  API serialization.
- `frontend/` — Dashboard, Farmers, Hardware and History tabs, reusable form/modal/toast components,
  validation and API client.
- `README.md` — this file.
