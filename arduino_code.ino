/*
  IMU Band — Arduino reads the MMA7361 accelerometer and the MAX30102 pulse sensor, and serves pitch / roll / bpm to the website.

  Wi-Fi:  website polls  http://arduino.local:5555/   ->  {"pitch":-72.4,"roll":3.1,...,"bpm":72}
  Calibration and rep counting run on the website, so the band itself stays simple.
  Wiring:
    MMA7361   X -> A0, Y -> A1, Z -> A2, VCC -> 3.3V, GND -> GND, SL (sleep) -> 3.3V
    GY-MAX30102  SDA -> A4 (SDA), SCL -> A5 (SCL), VIN -> 3.3V, GND -> GND
*/

#include <Wire.h>
#include <MAX30105.h>      // SparkFun library; also supports the MAX30102
#include <heartRate.h>

// ---------- accelerometer ----------
const int PIN_X = A0, PIN_Y = A1, PIN_Z = A2;
const float VREF   = 5.0;    // analog reference voltage
const float ZERO_G = 1.65;   // MMA7361 output at 0 g (V)
const float SENS   = 0.8;    // V per g at the 1.5 g range
const float ALPHA  = 0.05;   // Lower = smoother (time constant ~100 ms)
const float MIN_TILT_G = 0.3; // below this, roll is too ill-defined to trust
const unsigned long SETTLE_MS = 1500;  // let the filter settle before taking the roll reference

float gx = 0, gy = 0, gz = 1, pitch = 0, roll = 0;
float rollRef = 0;           // raw roll at power-up; roll is reported relative to this
bool rollRefSet = false;

float toG(int raw) { return (raw * VREF / 1023.0 - ZERO_G) / SENS; }

void readIMU() {
  gx += ALPHA * (toG(analogRead(PIN_X)) - gx);
  gy += ALPHA * (toG(analogRead(PIN_Y)) - gy);
  gz += ALPHA * (toG(analogRead(PIN_Z)) - gz);

  float yz = sqrt(gy * gy + gz * gz);
  pitch = atan2(gx, yz) * 180.0 / PI;

  if (yz > MIN_TILT_G) {
    float raw = atan2(gy, gz) * 180.0 / PI;      // -180..180
    if (!rollRefSet) {
      if (millis() > SETTLE_MS) { rollRef = raw; rollRefSet = true; }
    } else {
      float r = raw - rollRef;                   // relative to the boot pose, wrapped to -180..180
      if (r > 180)  r -= 360;
      if (r < -180) r += 360;
      roll = r;
    }
  }
}

// ---------- heart rate (MAX30102) ----------
MAX30105 heartSensor;
bool heartSensorFound = false;
bool heartRateValid = false;
float heartRateBPM = 0;
float heartRates[4] = {0};
byte heartRateIndex = 0;
byte heartRateCount = 0;
unsigned long lastBeatTime = 0;
unsigned long lastHeartSample = 0;
unsigned long lastHeartService = 0;
long lastIR = 0;                              // latest raw IR value, sent to the website for debugging
const long fingerThreshold = 50000;
const unsigned long maxServiceGapMs = 250;    // FIFO overflows at ~320 ms
const uint16_t fifoOverflowLimit = 28;        // near the 32-sample FIFO size, data was likely lost

void resetHeartRate() {
  heartRateValid = false;
  heartRateCount = 0;
  heartRateIndex = 0;
  lastBeatTime = 0;
}

void updateHeartRate() {
  if (!heartSensorFound) return;
  unsigned long now = millis();

  if (lastHeartService && now - lastHeartService > maxServiceGapMs) {
    heartSensor.clearFIFO();
    resetHeartRate();
  }
  lastHeartService = now;

  uint16_t received = heartSensor.check();
  if (received >= fifoOverflowLimit) {
    while (heartSensor.available()) heartSensor.nextSample();
    resetHeartRate();
    return;
  }

  int remaining = heartSensor.available();
  while (heartSensor.available()) {
    // 400 samples/sec averaged by four gives 100 FIFO samples/sec (one every 10 ms).
    unsigned long sampleTime = now - (remaining - 1) * 10UL;
    remaining--;
    long irValue = heartSensor.getFIFOIR();
    heartSensor.nextSample();
    lastHeartSample = now;
    lastIR = irValue;

    if (irValue < fingerThreshold) {
      resetHeartRate();
      continue;
    }

    if (checkForBeat(irValue)) {
      if (lastBeatTime) {
        unsigned long interval = sampleTime - lastBeatTime;
        float candidate = interval ? 60000.0f / interval : 0;

        if (candidate > 220) {
          continue;                           // double detection: keep the earlier beat as reference
        }

        if (candidate >= 30) {
          heartRates[heartRateIndex] = candidate;
          heartRateIndex = (heartRateIndex + 1) % 4;
          if (heartRateCount < 4) heartRateCount++;
          float total = 0;
          for (byte i = 0; i < heartRateCount; i++) total += heartRates[i];
          heartRateBPM = total / heartRateCount;
          heartRateValid = heartRateCount == 4;
        } else {
          resetHeartRate();                   // too slow: a beat was probably missed
        }
      }
      lastBeatTime = sampleTime;
    }
  }

  if (!lastBeatTime || now - lastBeatTime > 3000 ||
      now - lastHeartSample > 1000) {
    resetHeartRate();
  }
}

// ---------- output ----------
void printJson(Print &out) {
  out.print(F("{\"pitch\":")); out.print(pitch, 1);
  out.print(F(",\"roll\":"));   out.print(roll, 1);
  out.print(F(",\"gx\":"));     out.print(gx, 3);
  out.print(F(",\"gy\":"));     out.print(gy, 3);
  out.print(F(",\"gz\":"));     out.print(gz, 3);
  out.print(F(",\"ir\":"));     out.print(lastIR);
  out.print(F(",\"bpm\":"));
  if (heartRateValid) out.print((int)(heartRateBPM + 0.5f));
  else out.print(F("null"));
  out.print(F("}"));
}

void setup() {
  Serial.begin(115200);
  heartSensorFound = heartSensor.begin(Wire, I2C_SPEED_STANDARD);
  if (heartSensorFound) {
    heartSensor.setup(0x1F, 4, 2, 400, 411, 4096);
  }
}

void loop() {
  readIMU();
  updateHeartRate();
  static unsigned long last = 0;
  if (millis() - last >= 50) {     // 20 Hz
    last = millis();
    printJson(Serial);
    Serial.println();
  }
  delay(5);
}
