/*
  IMU Band — Arduino + Yun Wi-Fi shield
  Reads the MMA7361 accelerometer, computes pitch/roll, and serves it to the website.

  Wi-Fi:  website polls  http://arduino.local:5555/   ->  {"pitch":-72.4,"roll":3.1,...}
  USB:    set USE_YUN to 0 and the same JSON is printed on Serial (115200) for the
          website's "USB" mode (Chrome/Edge Web Serial).

  Calibration and rep counting run on the website, so the band itself stays simple.
  Wiring (same as the progress-check build):
    MMA7361 X -> A0, Y -> A1, Z -> A2, VCC -> 3.3V, GND -> GND, SL (sleep) -> 3.3V
*/

#define USE_YUN 1          // 1 = serve over Yun Wi-Fi shield, 0 = USB serial only

#if USE_YUN
  #include <Bridge.h>
  #include <BridgeServer.h>
  #include <BridgeClient.h>
  BridgeServer server(5555);
#endif

const int PIN_X = A0, PIN_Y = A1, PIN_Z = A2;
const float VREF   = 5.0;    // analog reference voltage
const float ZERO_G = 1.65;   // MMA7361 output at 0 g (V)
const float SENS   = 0.8;    // V per g at the 1.5 g range
const float ALPHA  = 0.2;    // smoothing (0..1, lower = smoother)

float gx = 0, gy = 0, gz = 1, pitch = 0, roll = 0;

float toG(int raw) { return (raw * VREF / 1023.0 - ZERO_G) / SENS; }

void readIMU() {
  gx += ALPHA * (toG(analogRead(PIN_X)) - gx);
  gy += ALPHA * (toG(analogRead(PIN_Y)) - gy);
  gz += ALPHA * (toG(analogRead(PIN_Z)) - gz);
  pitch = atan2(gx, sqrt(gy * gy + gz * gz)) * 180.0 / PI;
  roll  = atan2(gy, gz) * 180.0 / PI;
}

void printJson(Print &out) {
  out.print(F("{\"pitch\":")); out.print(pitch, 1);
  out.print(F(",\"roll\":"));   out.print(roll, 1);
  out.print(F(",\"gx\":"));     out.print(gx, 3);
  out.print(F(",\"gy\":"));     out.print(gy, 3);
  out.print(F(",\"gz\":"));     out.print(gz, 3);
  out.print(F("}"));
}

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
#if USE_YUN
  digitalWrite(LED_BUILTIN, LOW);
  Bridge.begin();                 // takes a few seconds; LED turns on when ready
  server.noListenOnLocalhost();   // accept connections from the network, not just the Yun itself
  server.begin();
  digitalWrite(LED_BUILTIN, HIGH);
#else
  Serial.begin(115200);
#endif
}

void loop() {
  readIMU();

#if USE_YUN
  BridgeClient client = server.accept();
  if (client) {
    client.setTimeout(20);
    while (client.available()) client.read();          // discard the HTTP request
    client.print(F("HTTP/1.1 200 OK\r\n"
                   "Content-Type: application/json\r\n"
                   "Access-Control-Allow-Origin: *\r\n" // lets the website read it from any page
                   "Cache-Control: no-store\r\n"
                   "Connection: close\r\n\r\n"));
    printJson(client);
    client.stop();
  }
#else
  static unsigned long last = 0;
  if (millis() - last >= 50) {     // 20 Hz
    last = millis();
    printJson(Serial);
    Serial.println();
  }
#endif

  delay(5);
}
