# IMU Exercise Wristband

A wearable IMU band that tracks exercise reps and range of motion, with a website that guides a full CCCARE exercise session: warm-up and cardio with heart-rate zones, strength training with rep counting, stretches, and cool-down.

## Using it

1. **Warm-up & cardio**: 3–5 min easy, then 15–30 min at 40–60% of heart-rate reserve. Enter your resting and max HR. Heart rate comes from a Bluetooth monitor or is typed in from the machine.
2. **Strength**: tap an exercise to see a demo, then strap on the band where it shows. Calibrate the start (A) and end (B) positions and do 1–2 sets of 10–20 reps. Every set is logged.
3. **Cool-down**: 3–5 min easy.

## What's here

- `website/` – The tracker site (plain HTML/CSS/JS, no build step).
- `mma7361_tilt.ino` – Standalone tilt test sketch.

## Running the website

You need Python and Chrome/Edge.
Run the following lines in your terminal:

    cd website
    python -m http.server 8080

Then open:
- http://localhost:8080/?demo – demo mode, which simulates the band and heart rate (no hardware needed)
- http://localhost:8080/ – real band: connect over Wi-Fi (default `arduino.local:5555`) or USB

Use `localhost`, not a double-clicked `index.html`. USB and Bluetooth heart-rate monitors only work on a secure page in Chrome or Edge.

## Use of LLM

An AI assistant (Claude) helped with some of the repetitive parts of the website, like setting up the exercise list, adding similar pages and styles for each exercise, and tidying up the layout. ChatGPT 6.1 Sol helped with conceptualization to come up with possible IMU wearable prototypes to solve problem 2. AI was used to debug some code errors. It also helped format this README. 
