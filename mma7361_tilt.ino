#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// Screen Variables
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

// Pin Definitions
const int repLED = 4;
const int setLED = 5;
const int buttonPin = 7;
const int xPin = A0;
const int yPin = A1;
const int zPin = A2;
const int sleepPin = 13;

// Calibration values
const int zeroG_X = 338;
const int zeroG_Y = 338;
const int zeroG_Z = 338;
const float pitch_roll_range = 0.75;

//position variables
float init_pitch;
float init_roll;
float final_pitch;
float final_roll;

float current_pitch;
float current_roll;

float starting_pitch_high;
float starting_pitch_low;
float final_pitch_high;
float final_pitch_low;
float starting_roll_high;
float starting_roll_low;
float final_roll_high;
float final_roll_low;

bool went_to_starting = false;

//Variables
const float sensitivity = 164.0;
bool done_starting_calibration = false;
bool done_calibration = false;
int rep_count = 0;

#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

void setup() {
  Serial.begin(9600);

  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  pinMode(repLED,OUTPUT);
  pinMode(setLED,OUTPUT);
  pinMode(buttonPin,INPUT);

  // Wake up the MMA7361 sensor
  pinMode(sleepPin, OUTPUT);
  digitalWrite(sleepPin, HIGH); 
  
  delay(100); // Allow sensor to stabilize
}

void loop() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(5,0);

  if(!done_calibration){
    if(!done_starting_calibration){
      display.print("Press button to start calibration.");
      display.display();
      delay(100);
      if(digitalRead(buttonPin) == 1){
        display.clearDisplay();
        display.print("Hold starting position for 3 seconds.");
        display.display();
        for(int i = 0; i < 30; i++){
          float temp_pitch;
          float temp_roll;
          getTiltAngles(temp_pitch,temp_roll);
          init_pitch += temp_pitch;
          init_roll += temp_roll;
          delay(100);
        }
        //get the average pitch and roll for the inital position (will +- 5% later to set a range for the inital position)
        init_pitch /= 30.0;
        init_roll /= 30.0;
      
        starting_pitch_low = init_pitch*(1-pitch_roll_range);
        starting_pitch_high = init_pitch*(1+pitch_roll_range);
        if(init_pitch < 0){
          float temp = starting_pitch_low;
          starting_pitch_low = starting_pitch_high;
          starting_pitch_high = temp;
        }

        starting_roll_high = init_roll*(1+pitch_roll_range);
        starting_roll_low = init_roll*(1-pitch_roll_range);
        if(init_roll < 0){
          float temp = starting_roll_low;
          starting_roll_low = starting_roll_high;
          starting_roll_high = temp;
        }

        done_starting_calibration = true;
      }
    }
    else {
      display.clearDisplay();
      display.print("Press button to set final position");
      display.display();
      if(digitalRead(buttonPin) == 1){
        display.clearDisplay();
        display.print("Hold final position for 3 seconds");
        display.display();
        for(int i = 0; i < 30; i++){
          float temp_pitch;
          float temp_roll;
          getTiltAngles(temp_pitch,temp_roll);
          final_pitch += temp_pitch;
          final_roll += temp_roll;
          delay(100);
        }
        final_pitch /= 30.0;
        final_roll /= 30.0;

        final_pitch_low = final_pitch*(1-pitch_roll_range);
        final_pitch_high = final_pitch*(1+pitch_roll_range);
        if(final_pitch < 0){
          float temp = final_pitch_low;
          final_pitch_low = final_pitch_high;
          final_pitch_high = temp;
        }

        final_roll_low = final_roll*(1-pitch_roll_range);
        final_roll_high = final_roll*(1+pitch_roll_range);
        if(final_roll < 0){
          float temp = final_roll_low;
          final_roll_low = final_roll_high;
          final_roll_high = temp;
        }

        done_calibration = true;
      }
    }
  }
  else if(done_calibration){
    display.clearDisplay();
    display.print("Rep count: ");
    display.print(rep_count);
    display.display();
    delay(100);

    getTiltAngles(current_pitch,current_roll);
    if(inStartingRange()){
      digitalWrite(repLED,HIGH);
      went_to_starting = true;
    }
    if(went_to_starting){
      if(inFinalRange()){
        digitalWrite(repLED,LOW);
        ++rep_count;
        went_to_starting = false;
      }
    }
  }
}

void getTiltAngles(float &pitch, float &roll) {
  // Read raw ADC values
  int rawX = analogRead(xPin);
  int rawY = analogRead(yPin);
  int rawZ = analogRead(zPin);

  // Convert raw values to acceleration in "g" units
  float gX = (rawX - zeroG_X) / sensitivity;
  float gY = (rawY - zeroG_Y) / sensitivity;
  float gZ = (rawZ - zeroG_Z) / sensitivity;

  // Calculate Pitch and Roll in radians using trigonometry
  float rollRad  = atan2(gY, gZ);
  float pitchRad = atan2(-gX, sqrt(gY * gY + gZ * gZ));

  // Convert radians to degrees and update the referenced variables
  roll  = rollRad * 180.0 / M_PI;
  pitch = pitchRad * 180.0 / M_PI;
}

bool inStartingRange(){
  if(current_pitch <= starting_pitch_high && current_pitch >= starting_pitch_low){
    if(current_roll <= starting_roll_high && current_roll >= starting_roll_low)
      return true;
  }
  return false;
}

bool inFinalRange(){
  if(current_pitch <= final_pitch_high && current_pitch >= final_pitch_low){
    if(current_roll <= final_roll_high && current_roll >= final_roll_low)
      return true;
  }
  return false;
}
