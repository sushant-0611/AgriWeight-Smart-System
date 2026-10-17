# AgriWeight Smart System

Full-stack web application for the ESP32-based AgriWeight agricultural weighing machine.
React + Vite frontend, Node.js + Express backend, MongoDB Atlas database, live ESP32 telemetry over HTTP.

## Folder Structure

```
Project/
  AgriWeight_ESP32_Code/     ESP32 firmware (Arduino IDE)
    AgriWeight_all_components.ino
  frontend/                  React + Vite + Bootstrap dashboard
  backend/                   Express + Mongoose API
    src/
      config.js              Environment configuration
      db.js                  MongoDB connection
      models/                Farmer, WeighingRecord, Device schemas
      routes/                devices, weighings, farmers endpoints
      middleware/            hardware API-key auth, error handling
      utils/                 money rounding, serializers, helpers
    .env                     Secrets (never commit / never share)
    .env.example            Template without secrets
```

## Backend — Run (PowerShell)

```powershell
cd "D:\Clients\AgriWeight Smart System\Project\backend"
npm install
npm start
```

Runs at `http://localhost:5000`. Requires `.env` (already created) with `MONGODB_URI`, `DEVICE_API_KEY`, `PORT`, `DEFAULT_DEVICE_ID`, `OFFLINE_TIMEOUT_MS`.

## Frontend — Run (PowerShell)

```powershell
cd "D:\Clients\AgriWeight Smart System\Project\frontend"
npm install
npm run dev
```

Opens at `http://localhost:5173`. Optional `.env` (see `.env.example`):
`VITE_API_URL` (default `http://localhost:5000`) and `VITE_DEVICE_ID` (default `AGRIWEIGHT-01`).

Production build: `npm run build`, serve `dist/` with any static host and point `VITE_API_URL` at the backend.

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
- Zero/tare, keypad, OLED, buzzer and LED behaviour is unchanged from the original firmware.

## API

All responses use the envelope `{ "success": boolean, "data": ... }` or `{ "success": false, "error": { "message": "..." } }`.
Hardware endpoints require header `x-api-key: <DEVICE_API_KEY>`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server health check |
| POST | `/api/devices/telemetry` | ESP32 heartbeat: `device_id`, `net_weight_kg`, `mode`, `farmer_id`, `price_per_kg` |
| GET | `/api/devices/:deviceId/status` | Online flag, last-seen, latest telemetry, current-farmer totals, last record |
| POST | `/api/weighings` | Save a weighing: `farmer_id`, `weight_kg`, `price_per_kg`, optional `device_id`, `mode`, `record_key`. Auto-creates the farmer; `total_amount` is calculated by the backend |
| GET | `/api/weighings` | Recent records, optional `farmer_id`, `device_id`, `page`, `limit` |
| GET | `/api/farmers` | One row per farmer: crates, total weight, total amount |
| GET | `/api/farmers/:farmerId/summary` | Farmer totals + latest price/kg |
| GET | `/api/farmers/:farmerId/records` | Paginated records (`page`, `limit`), newest first, with per-farmer sequential `recordNo` |

Timestamps are stored in UTC (ISO 8601); the frontend displays them in IST (Asia/Kolkata).
Money is rounded to 2 decimals and weight to 3 decimals before storage and aggregation.
`crate_number` is `null` — the current hardware has no crate IDs, so the UI shows the documented weighing sequence number instead.

## Testing Summary (performed 15 Oct 2026)

- Telemetry heartbeat, online/offline timeout: verified.
- Weighing save with automatic farmer creation: verified.
- Idempotent retry with duplicate `record_key`: verified (same record returned, no duplicate row).
- Farmer list / summary / paginated records with sequential record numbers: verified.
- Validation and error paths (missing API key → 401, zero weight → 400, unknown farmer → 404): verified.
- End-to-end in browser: Dashboard live weight/estimate/totals and History farmer views verified against the live backend and Atlas database.

Test data created here was removed afterwards; any records present now come from the real device.

## Hardware Notes

- All HTTP work (telemetry + save) runs on a dedicated FreeRTOS task pinned to core 0. The main loop (core 1) only reads buttons/keypad/HX711 and never blocks on the network, so every press registers immediately and the display stays smooth even while the server is unreachable.
- Saves are queued to the network task; a failed save retries with the same `record_key`, so the server never stores a duplicate.
- Hardware integration itself (HX711 readings, AUTO/MANUAL save on the actual device) was verified on the physical ESP32 only by the client — still do a final check with the real device before delivery.
- When the server is unreachable, telemetry slows down automatically (2 failed sends → 10 s interval) to keep Wi-Fi and the UI responsive.
- The dashboard is read-only by design; weighing control stays on the hardware.

## Client Delivery Checklist

1. **Backend computer:** copy `backend/` to the client PC, create `backend/.env` from `.env.example` (real `MONGODB_URI` + matching `DEVICE_API_KEY`), then `npm install` and `npm start`.
2. **Frontend:** `npm install` and `npm run dev` for development, or `npm run build` and host `dist/` statically with `VITE_API_URL` pointing at the backend.
3. **ESP32:** set `SERVER_HOST` to the backend PC's LAN IP (check `ipconfig`), set Wi-Fi credentials and `DEVICE_API_KEY`, then upload.
4. **Verify:** device shows Online on the Dashboard; save one weighing in each mode; confirm the farmer appears in History.
5. When zipping the project for delivery, exclude `node_modules/`, `dist/` and `backend/.env`.

## Changed / Added Files

- `AgriWeight_ESP32_Code/AgriWeight_all_components/AgriWeight_all_components.ino` — added telemetry heartbeat (with offline backoff), device ID, API key, `record_key` idempotency, save retry, error-specific status messages; button pins per delivered wiring (MODE = pin 4, ENTRY = pin 5).
- `frontend/` — complete React app (new): layout, Dashboard, History, FarmerDetail, API client, theme CSS.
- `backend/` — complete Express API (new): models, routes, auth middleware, validation, config.
- `README.md` — this file.
