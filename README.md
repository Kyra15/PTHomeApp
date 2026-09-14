# Home PT Coach

An at-home physical therapy companion built with **React Native + TypeScript + Expo**.
It uses your iPhone's accelerometer and gyroscope to detect real arm movement,
so a person can hold the phone in their hand while exercising and get live
feedback — a moving diagram, full-screen color changes, spoken cues, gentle
vibration, and sound — instead of having to read anything small or fiddly.

Built with seniors and people with limited hand/finger mobility in mind:
large text, big buttons (72px+ tall), high contrast, minimal steps per
screen, and audio/haptic feedback so you don't have to stare at the screen
while moving.

> ⚠️ **Not a medical device.** This app doesn't diagnose or measure
> clinical range of motion. It's a motivational aid for exercises your own
> physical therapist has already prescribed. Always follow their guidance,
> and stop immediately if anything hurts.

## What's included

Four example exercises, covering both ways the app can sense motion:

| Exercise | Sensor | What it measures |
|---|---|---|
| Front Arm Raise | Accelerometer | Tilt angle of the phone as you lift your arm forward |
| Side Arm Raise | Accelerometer | Tilt angle of the phone as you lift your arm out to the side |
| Shoulder Circles | Gyroscope | Total rotation as you swing your arm in a circle |
| Wrist Circles | Gyroscope | Total rotation as you rotate your wrist in a circle |

Each exercise screen:
1. Shows plain-language, numbered instructions with a preview diagram.
2. Runs a 3-second "hold still" calibration so the app learns your resting position.
3. Tracks your motion live: a stick-figure diagram mirrors your real movement,
   the whole screen changes color as you move toward the target (blue → amber
   → green), and you get a vibration + chime + a spoken rep count each time
   you complete a rep.
4. Ends with a "Great job!" screen and lets you repeat or go back.

## Requirements

- Node.js 18+
- The **Expo Go** app on a physical iPhone (motion sensors don't work in the
  iOS Simulator — you need a real device), or an iOS/Android development build
- macOS is only required if you want to build a native binary; for everyday
  use, Expo Go is enough

## Getting started

```bash
npm install
npx expo start
```

Then scan the QR code with your iPhone's camera (it will open in **Expo Go**),
or press `i` in the terminal if you have Xcode's iOS Simulator set up (note:
the simulator can run the app, but exercises will report "sensors
unavailable" since it can't simulate real motion).

## Project structure

```
App.tsx                     # Navigation container + sound preloading
src/
  theme/theme.ts             # Colors, type scale, spacing — the design tokens
  types/exercise.ts          # Shared TypeScript types
  data/exercises.ts          # The exercise library (add new exercises here)
  hooks/useExerciseEngine.ts # Sensor subscriptions, calibration, rep counting
  components/
    MotionDiagram.tsx        # Live SVG diagram driven by the real sensor angle
    BigButton.tsx            # Large, high-contrast button
    RepProgressDots.tsx      # Big dot-based rep progress indicator
    FlashOverlay.tsx         # Full-screen celebratory flash animation
  screens/
    HomeScreen.tsx           # Exercise picker
    ExerciseScreen.tsx       # Instructions → calibration → live session
    CompleteScreen.tsx       # End-of-exercise summary
  navigation/                # React Navigation stack + types
  utils/
    color.ts                 # Hex color blending for the live background
    sound.ts                 # expo-av sound effect playback
    speech.ts                # expo-speech spoken cues
    haptics.ts                # expo-haptics vibration cues
assets/sounds/               # Generated WAV chimes (no external audio needed)
```

## How the motion detection works

- **Tilt exercises** (arm raises): during calibration, the app averages a
  couple of accelerometer readings while you hold still to learn "this is
  what resting looks like." While exercising, it computes the angle between
  your phone's current orientation and that resting orientation. This works
  regardless of exactly how you're holding the phone, since it's a relative
  angle, not a fixed axis.
- **Rotation exercises** (circles): the app integrates the gyroscope's
  angular speed over time to track how many total degrees you've rotated,
  regardless of which axis the circle happens around. Once you've covered
  360°, that's one rep.
- A soft "you're moving a little fast" cue appears if the tracked speed
  gets high, encouraging slow, controlled movement.

This is intentionally simple and robust rather than clinically precise — it's
built to reward *consistent, complete* motion, not to replace a therapist's
measurements.

## Customizing

- **Add an exercise:** add an entry to `src/data/exercises.ts`. If it's a new
  kind of motion, add a matching `case` to `MotionDiagram.tsx` for its diagram.
- **Change the color/type scale:** everything lives in `src/theme/theme.ts`.
- **Change the sounds:** replace the `.wav` files in `assets/sounds/` (keep
  the same filenames, or update `src/utils/sound.ts`).
- **App icon/name:** update `app.json` and the images in `assets/`.

## Accessibility notes

- All primary buttons are at least 72px tall with 26px bold labels.
- Every color-based cue (screen tint, flash) is paired with a haptic pulse
  and/or spoken feedback, so the app remains usable for low-vision users.
- The exercise screen keeps the phone's screen awake for the whole session.
- A confirmation dialog protects against accidentally ending an exercise
  from a stray tap.
