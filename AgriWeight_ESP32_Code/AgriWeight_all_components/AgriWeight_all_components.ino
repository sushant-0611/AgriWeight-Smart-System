// Forward declarations: the Arduino builder inserts function prototypes
// above the first function in the sketch, so these types must be known
// before that point.
struct Button;
struct SaveJob;

#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/queue.h>
#include <freertos/semphr.h>
#include <Keypad.h>
#include <HX711.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// =================================================
// AGRIWEIGHT SMART WEIGHING SYSTEM
// ESP32 30-pin + HX711 + OLED + Keypad
// =================================================

// ---------- WIFI ----------
const char* WIFI_NAME = "OPPO F29 5G Sushh";
const char* WIFI_PASSWORD = "Sushant9560";

// Backend computer's LAN IP and port.
const char* SERVER_HOST = "http://10.43.209.169:5000";

// Must match the device ID on the backend (DEFAULT_DEVICE_ID in .env).
const char* DEVICE_ID = "AGRIWEIGHT-01";

// Must match DEVICE_API_KEY in the backend .env file.
const char* DEVICE_API_KEY =
  "agw_a3bc9a1bf38b7db3f6d4ffee04b2c90d2b6041ca0feb4dd8";

// ---------- REGISTERED FARMER IDS ----------
// Only these fixed 4-digit IDs are accepted from the keypad.
// Keep this list identical to REGISTERED_FARMER_IDS in the backend .env.
const char* REGISTERED_FARMER_IDS[] = {
  "1001", "1002", "1003", "1004", "1005",
  "1006", "1007", "1008", "1009", "1010"
};
const uint8_t REGISTERED_FARMER_COUNT =
  sizeof(REGISTERED_FARMER_IDS) / sizeof(REGISTERED_FARMER_IDS[0]);

bool isRegisteredFarmerId(const String &id) {
  if (id.length() != 4) return false;

  for (uint8_t i = 0; i < REGISTERED_FARMER_COUNT; i++) {
    if (id == REGISTERED_FARMER_IDS[i]) return true;
  }

  return false;
}

// ---------- HX711 ----------
#define HX711_DOUT 25
#define HX711_SCK  26

// ---------- OLED ----------
#define OLED_SDA 21
#define OLED_SCL 22
#define OLED_ADDRESS 0x3C

Adafruit_SSD1306 display(128, 64, &Wire, -1);
HX711 scale;

// ---------- FOUR BUTTONS ----------
#define ZERO_BUTTON   5
#define SAVE_BUTTON   4
#define ENTRY_BUTTON   35
#define MODE_BUTTON    34

// ---------- OUTPUTS ----------
#define RED_LED        2
#define BUZZER_PIN    12

// ---------- 4x4 KEYPAD ----------
const byte ROWS = 4;
const byte COLS = 4;

char keys[ROWS][COLS] = {
  {'1', '2', '3', 'A'},
  {'4', '5', '6', 'B'},
  {'7', '8', '9', 'C'},
  {'*', '0', '#', 'D'}
};

byte rowPins[ROWS] = {13, 14, 18, 19};
byte colPins[COLS] = {23, 27, 32, 33};

Keypad keypad = Keypad(
  makeKeymap(keys), rowPins, colPins, ROWS, COLS
);

// ---------- CALIBRATION ----------
float calibrationFactor = 256.55;

// ---------- WEIGHT SETTINGS ----------
const float smoothingAlpha = 0.45;
const float zeroThresholdGrams = 0.5;
const float stabilityToleranceGrams = 2.0;
const float removalThresholdGrams = 5.0;

const unsigned long stableDurationMs = 1500;
const unsigned long displayIntervalMs = 150;
const unsigned long telemetryIntervalMs = 2000;
const unsigned long saveRetryIntervalMs = 5000;

// ---------- MODE ----------
enum WeighMode {
  AUTO_MODE,
  MANUAL_MODE
};

WeighMode mode = AUTO_MODE;

// ---------- DATA ----------
float filteredGrams = 0.0;
float previousSampleGrams = 0.0;

bool filterInitialized = false;
bool weightStable = false;
bool waitingForRemoval = false;
bool tareRequested = false;

unsigned long stableSince = 0;
unsigned long removalSince = 0;
unsigned long lastDisplayUpdate = 0;
unsigned long lastSaveAttemptMs = 0;

String farmerId = "";
String priceInput = "";
String keypadInput = "";
String statusText = "STARTING";

// ---------- NETWORK TASK SHARED STATE ----------
struct SaveJob {
  char farmerId[33];
  float weightKg;
  float pricePerKg;
  uint8_t mode;
  char recordKey[24];
};

QueueHandle_t saveQueue = NULL;
SemaphoreHandle_t snapshotMutex = NULL;

// Main loop hands over a job, then watches saveResult:
// 0 = none, 1 = saved, -1 = network fail, -2 = auth error,
// -3 = server rejected.
volatile bool savePending = false;
volatile int8_t saveResult = 0;

struct TelemetrySnapshot {
  float weightKg;
  uint8_t mode;
  char farmerId[33];
  float pricePerKg;
  bool hasPrice;
};

TelemetrySnapshot telSnap = {0.0f, 0, {0}, 0.0f, false};

// Entry field: 0 = Farmer ID, 1 = Price/kg
int selectedField = 0;
bool farmerEntered = false;
bool priceEntered = false;

// ---------- BUTTON DEBOUNCE ----------
struct Button {
  uint8_t pin;
  bool lastReading;
  bool stableState;
  unsigned long changedAt;
};

Button zeroBtn  = {ZERO_BUTTON, false, false, 0};
Button saveBtn  = {SAVE_BUTTON, false, false, 0};
Button entryBtn = {ENTRY_BUTTON, false, false, 0};
Button modeBtn  = {MODE_BUTTON, false, false, 0};

bool buttonPressed(Button &b) {
  bool reading = digitalRead(b.pin);
  unsigned long now = millis();

  if (reading != b.lastReading) {
    b.lastReading = reading;
    b.changedAt = now;
  }

  if (now - b.changedAt >= 35 &&
      reading != b.stableState) {
    b.stableState = reading;
    return b.stableState == HIGH;
  }

  return false;
}

// ---------- TELEMETRY SNAPSHOT ----------
// Must stay below struct Button: the Arduino IDE inserts
// auto-generated function prototypes before the first function
// definition in the file.
void updateTelemetrySnapshot() {
  if (xSemaphoreTake(snapshotMutex, 0) != pdTRUE) return;

  telSnap.weightKg = max(0.0f, filteredGrams / 1000.0f);
  telSnap.mode = mode == AUTO_MODE ? 0 : 1;
  farmerId.toCharArray(telSnap.farmerId, sizeof(telSnap.farmerId));
  telSnap.hasPrice = priceInput.length() > 0;
  telSnap.pricePerKg = priceInput.toFloat();

  xSemaphoreGive(snapshotMutex);
}

// ---------- FEEDBACK (non-blocking) ----------
// Buzzer and LED are turned off by timers in the main loop,
// so input handling here never blocks.
unsigned long buzzerOffAt = 0;
unsigned long redLedOffAt = 0;

void startBeep(unsigned int ms) {
  digitalWrite(BUZZER_PIN, HIGH);
  buzzerOffAt = millis() + ms;
  if (buzzerOffAt == 0) buzzerOffAt = 1;
}

void startBlinkRed(unsigned int ms) {
  digitalWrite(RED_LED, HIGH);
  redLedOffAt = millis() + ms;
  if (redLedOffAt == 0) redLedOffAt = 1;
}

void handleFeedbackTimers() {
  if (buzzerOffAt != 0 &&
      (long)(millis() - buzzerOffAt) >= 0) {
    digitalWrite(BUZZER_PIN, LOW);
    buzzerOffAt = 0;
  }

  if (redLedOffAt != 0 &&
      (long)(millis() - redLedOffAt) >= 0) {
    digitalWrite(RED_LED, LOW);
    redLedOffAt = 0;
  }
}

void buttonFeedback() {
  // Every button press gives both indications.
  startBeep(45);
  startBlinkRed(65);
}

void successFeedback() {
  startBeep(120);
  startBlinkRed(180);
}

// ---------- OLED UI ----------
void drawScreen() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  // Top row: weight at left, mode at right.
  display.setTextSize(1);
  display.setCursor(0, 0);

  float kg = filteredGrams / 1000.0;
  if (fabs(kg) < 0.0005) kg = 0.0;

  if (kg < 0) {
    display.print("-");
    kg = -kg;
  }

  display.print(kg, 3);
  display.print(" kg");

  display.setCursor(88, 0);
  display.print(mode == AUTO_MODE ? "AUTO" : "MANUAL");

  display.drawLine(0, 11, 127, 11, SSD1306_WHITE);

  // Farmer ID
  display.setCursor(0, 16);
  display.print("Farmer ID: ");
  display.print(farmerId.length() ? farmerId : "--");

  // Price
  display.setCursor(0, 28);
  display.print("Price/kg: Rs ");
  display.print(priceInput.length() ? priceInput : "--");

  // Current keypad entry
  display.setCursor(0, 40);
  if (selectedField == 0) {
    display.print("ID input: ");
  } else {
    display.print("Price input: ");
  }

  String shownInput = keypadInput;
  if (shownInput.length() > 12) {
    shownInput = shownInput.substring(
      shownInput.length() - 12
    );
  }
  display.print(shownInput);

  display.drawLine(0, 51, 127, 51, SSD1306_WHITE);

  display.setCursor(0, 55);
  display.print(statusText.substring(0, 21));

  display.display();
}

void showMessage(const String &line1,
                 const String &line2) {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(8, 18);
  display.println(line1);
  display.setCursor(8, 34);
  display.println(line2);
  display.display();
}

// ---------- ENTRY BUTTON ----------
void cycleEntryField() {
  selectedField = 1 - selectedField;
  keypadInput = "";

  if (selectedField == 0) {
    statusText = "ENTER FARMER ID";
  } else {
    statusText = "ENTER PRICE PER KG";
  }
}

// ---------- KEYPAD INPUT ----------
// Digits: enter value
// #     : confirm current field
// *     : delete last character
// A     : clear current input
// D     : clear all farmer/price data
void handleKeypad() {
  char key = keypad.getKey();
  if (!key) return;

  buttonFeedback();

  if (key == 'A') {
    keypadInput = "";
    statusText = "INPUT CLEARED";
    return;
  }

  if (key == '*') {
    if (keypadInput.length() > 0) {
      keypadInput.remove(keypadInput.length() - 1);
    }
    return;
  }

  if (key == 'D') {
    farmerId = "";
    priceInput = "";
    keypadInput = "";
    farmerEntered = false;
    priceEntered = false;
    selectedField = 0;
    statusText = "DATA CLEARED";
    return;
  }

  if (key == '#') {
    if (keypadInput.length() == 0) {
      statusText = "ENTER A VALUE";
      return;
    }

    if (selectedField == 0) {
      // Only the fixed registered 4-digit IDs may be accepted.
      // A rejected ID is not stored, so the operator cannot weigh
      // against an arbitrary farmer number.
      if (!isRegisteredFarmerId(keypadInput)) {
        statusText = "ID NOT REGISTERED";
        keypadInput = "";
        startBeep(200);
        startBlinkRed(400);
        return;
      }

      farmerId = keypadInput;
      farmerEntered = true;
      selectedField = 1;
      statusText = "ENTER PRICE PER KG";
    } else {
      float p = keypadInput.toFloat();

      if (p < 0) {
        statusText = "INVALID PRICE";
        return;
      }

      priceInput = keypadInput;
      priceEntered = true;
      statusText = "DETAILS READY";
    }

    keypadInput = "";
    return;
  }

  bool valid =
    (key >= '0' && key <= '9') ||
    (key == '.' && selectedField == 1);

  if (valid && keypadInput.length() < 12) {
    if (key != '.' || keypadInput.indexOf('.') == -1) {
      keypadInput += key;
    }
  }
}

// ---------- WIFI ----------
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_NAME, WIFI_PASSWORD);

  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED &&
         millis() - started < 8000) {
    delay(100);
  }

  statusText = WiFi.status() == WL_CONNECTED
    ? "WIFI CONNECTED"
    : "WIFI NOT CONNECTED";
}

// ---------- ZERO / TARE ----------
void performZero() {
  if (waitingForRemoval &&
      fabs(filteredGrams) > removalThresholdGrams) {
    statusText = "REMOVE LOAD FIRST";
    return;
  }

  showMessage("ZEROING SCALE", "KEEP PLATFORM EMPTY");

  // Tare uses multiple HX711 readings and takes time.
  scale.tare(10);

  filteredGrams = 0.0;
  previousSampleGrams = 0.0;
  filterInitialized = false;
  weightStable = false;
  stableSince = 0;
  removalSince = 0;
  waitingForRemoval = false;

  statusText = "ZERO COMPLETE";
}

// ---------- NETWORK TASK ----------
// All HTTP runs on core 0 in its own task, so the weighing loop,
// buttons and keypad on core 1 are never paused by a network call.
int8_t postWeighing(const SaveJob &job) {
  if (WiFi.status() != WL_CONNECTED) return -1;

  HTTPClient http;
  http.setTimeout(4000);

  if (!http.begin(String(SERVER_HOST) + "/api/weighings")) {
    return -1;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", DEVICE_API_KEY);

  // Send numeric Farmer ID as a string.
  String payload = "{";
  payload += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"farmer_id\":\"" + String(job.farmerId) + "\",";
  payload += "\"weight_kg\":" + String(job.weightKg, 3) + ",";
  payload += "\"price_per_kg\":" + String(job.pricePerKg, 2) + ",";
  payload += "\"mode\":\"" +
             String(job.mode == 0 ? "AUTO" : "MANUAL") + "\",";
  payload += "\"record_key\":\"" + String(job.recordKey) + "\"";
  payload += "}";

  int code = http.POST(payload);
  http.end();

  if (code >= 200 && code < 300) return 1;
  if (code == 401) return -2;
  if (code == 400) return -3;
  if (code == 422) return -4;  // unregistered farmer ID rejected
  return -1;
}

bool postTelemetry() {
  if (WiFi.status() != WL_CONNECTED) return false;

  float weightKg;
  uint8_t modeNow;
  char farmer[33];
  float pricePerKg;
  bool hasPrice;

  if (xSemaphoreTake(snapshotMutex, 0) != pdTRUE) return false;
  weightKg = telSnap.weightKg;
  modeNow = telSnap.mode;
  strncpy(farmer, telSnap.farmerId, sizeof(farmer));
  pricePerKg = telSnap.pricePerKg;
  hasPrice = telSnap.hasPrice;
  xSemaphoreGive(snapshotMutex);

  HTTPClient http;
  http.setTimeout(1500);

  if (!http.begin(String(SERVER_HOST) + "/api/devices/telemetry")) {
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", DEVICE_API_KEY);

  String payload = "{";
  payload += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"net_weight_kg\":" + String(weightKg, 3) + ",";
  payload += "\"mode\":\"" +
             String(modeNow == 0 ? "AUTO" : "MANUAL") + "\"";
  if (strlen(farmer)) {
    payload += ",\"farmer_id\":\"" + String(farmer) + "\"";
  }
  if (hasPrice) {
    payload += ",\"price_per_kg\":" + String(pricePerKg, 2);
  }
  payload += "}";

  int code = http.POST(payload);
  http.end();

  return code >= 200 && code < 300;
}

// Heartbeat runs on core 0 at a steady 2 s cadence with no
// backoff: the main loop never blocks on the network, and a slow
// hotspot must never space heartbeats past the server's offline
// timeout.
void networkTask(void *parameter) {
  unsigned long lastTelemetry = 0;

  for (;;) {
    SaveJob job;
    if (xQueueReceive(saveQueue, &job, 0) == pdTRUE) {
      saveResult = postWeighing(job);
      lastTelemetry = millis();
    }

    if (millis() - lastTelemetry >= telemetryIntervalMs) {
      lastTelemetry = millis();
      postTelemetry();
    }

    vTaskDelay(20 / portTICK_PERIOD_MS);
  }
}

// ---------- SAVE (queued to the network task) ----------
bool queueSaveJob() {
  if (savePending) return false;

  if (!weightStable) {
    statusText = "WAIT FOR STABLE WEIGHT";
    return false;
  }

  if (!farmerEntered || !priceEntered) {
    statusText = "ENTER ID AND PRICE";
    return false;
  }

  if (WiFi.status() != WL_CONNECTED) {
    statusText = "WIFI NOT CONNECTED";
    return false;
  }

  SaveJob job;
  farmerId.toCharArray(job.farmerId, sizeof(job.farmerId));
  job.weightKg = max(0.0f, filteredGrams / 1000.0f);
  job.pricePerKg = priceInput.toFloat();
  job.mode = mode == AUTO_MODE ? 0 : 1;

  // stableSince is unique per stable load: retries of a failed send
  // reuse the same record_key, so the server never double-saves.
  String(stableSince).toCharArray(job.recordKey, sizeof(job.recordKey));

  if (xQueueSend(saveQueue, &job, 0) != pdTRUE) {
    statusText = "SERVER BUSY - RETRY";
    return false;
  }

  savePending = true;
  lastSaveAttemptMs = millis();
  statusText = "SAVING RECORD";
  return true;
}

// ---------- MODE ----------
void switchMode() {
  mode = (mode == AUTO_MODE) ? MANUAL_MODE : AUTO_MODE;

  // Avoid auto-saving an already stable load simply
  // because the user changed modes.
  weightStable = false;
  stableSince = millis();

  statusText = mode == AUTO_MODE
    ? "AUTO MODE SELECTED"
    : "MANUAL MODE SELECTED";
}

// ---------- SETUP ----------
void setup() {
  Serial.begin(115200);

  // External 10k pull-down resistors required.
  pinMode(ZERO_BUTTON, INPUT);
  pinMode(SAVE_BUTTON, INPUT);
  pinMode(ENTRY_BUTTON, INPUT);
  pinMode(MODE_BUTTON, INPUT);

  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(RED_LED, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  Wire.begin(OLED_SDA, OLED_SCL);
  Wire.setClock(400000);

  if (!display.begin(
        SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
    while (true) delay(100);
  }

  showMessage("AgriWeight", "Initializing...");

  scale.begin(HX711_DOUT, HX711_SCK);

  unsigned long started = millis();
  while (!scale.is_ready() &&
         millis() - started < 5000) {
    delay(10);
  }

  if (!scale.is_ready()) {
    showMessage("HX711 ERROR", "Check connections");
    while (true) delay(100);
  }

  scale.set_scale(calibrationFactor);

  showMessage("KEEP PLATFORM", "EMPTY - ZEROING");
  delay(1000);
  scale.tare(10);

  connectWiFi();

  saveQueue = xQueueCreate(1, sizeof(SaveJob));
  snapshotMutex = xSemaphoreCreateMutex();
  if (!saveQueue || !snapshotMutex) {
    showMessage("NETWORK ERROR", "Task setup failed");
    while (true) delay(100);
  }

  xTaskCreatePinnedToCore(
    networkTask, "network", 10240, NULL, 1, NULL, 0);

  updateTelemetrySnapshot();

  statusText = "READY";
  drawScreen();
}

// ---------- MAIN LOOP ----------
void loop() {
  // Switch buzzer/LED off when their timers expire.
  handleFeedbackTimers();

  // Every physical button click gives beep + red blink.
  if (buttonPressed(zeroBtn)) {
    buttonFeedback();
    performZero();
  }

  if (buttonPressed(saveBtn)) {
    buttonFeedback();

    if (mode == MANUAL_MODE) {
      queueSaveJob();
    } else {
      statusText = "AUTO SAVE ENABLED";
    }
  }

  if (buttonPressed(entryBtn)) {
    buttonFeedback();
    cycleEntryField();
  }

  if (buttonPressed(modeBtn)) {
    buttonFeedback();
    switchMode();
  }

  handleKeypad();

  // Read a fresh HX711 conversion when available.
  if (scale.is_ready()) {
    float sample = scale.get_units(1);

    if (!filterInitialized) {
      filteredGrams = sample;
      previousSampleGrams = sample;
      filterInitialized = true;
      stableSince = millis();
    } else {
      filteredGrams =
        smoothingAlpha * sample +
        (1.0 - smoothingAlpha) * filteredGrams;

      unsigned long now = millis();

      if (fabs(sample - previousSampleGrams) <=
          stabilityToleranceGrams) {
        if (stableSince == 0) stableSince = now;

        if (now - stableSince >= stableDurationMs) {
          weightStable = true;
        }
      } else {
        stableSince = now;
        weightStable = false;
      }

      previousSampleGrams = sample;
    }

    if (fabs(filteredGrams) < zeroThresholdGrams) {
      filteredGrams = 0.0;
    }

    // After a save, wait for the load to be removed.
    if (waitingForRemoval) {
      if (fabs(filteredGrams) <= removalThresholdGrams) {
        if (removalSince == 0) removalSince = millis();

        if (millis() - removalSince >= 1000) {
          waitingForRemoval = false;
          removalSince = 0;
          statusText = "READY FOR NEXT LOAD";
        }
      } else {
        removalSince = 0;
      }
    }

    // AUTO mode: automatically save a stable load once.
    // Failed saves retry every saveRetryIntervalMs while the load
    // stays on the platform and the server is reachable again.
    if (mode == AUTO_MODE &&
        weightStable &&
        !waitingForRemoval &&
        !savePending &&
        millis() - lastSaveAttemptMs >= saveRetryIntervalMs &&
        farmerEntered &&
        priceEntered) {
      queueSaveJob();
    }
  }

  // Result of the save the network task performed.
  if (savePending && saveResult != 0) {
    savePending = false;
    int8_t result = saveResult;
    saveResult = 0;

    if (result == 1) {
      statusText = "RECORD SAVED";
      waitingForRemoval = true;
      weightStable = false;
      removalSince = 0;
      successFeedback();
    } else if (result == -2) {
      statusText = "AUTH ERROR - CHECK KEY";
    } else if (result == -3) {
      statusText = "SERVER REJECTED DATA";
    } else if (result == -4) {
      // The server refused an unregistered farmer ID: nothing saved.
      statusText = "ID NOT REGISTERED";
      startBeep(200);
      startBlinkRed(400);
    } else {
      statusText = "SAVE FAILED - RETRIES ON";
    }
  }

  updateTelemetrySnapshot();

  // Reconnect to Wi-Fi quickly if disconnected.
  static unsigned long lastWiFiRetry = 0;
  if (WiFi.status() != WL_CONNECTED &&
      millis() - lastWiFiRetry >= 5000) {
    lastWiFiRetry = millis();
    WiFi.reconnect();
  }

  if (millis() - lastDisplayUpdate >= displayIntervalMs) {
    lastDisplayUpdate = millis();
    drawScreen();
  }

  static unsigned long lastSerial = 0;
  if (millis() - lastSerial >= 500) {
    lastSerial = millis();
    Serial.print("Weight: ");
    Serial.print(filteredGrams / 1000.0, 3);
    Serial.println(" kg");
  }
}
