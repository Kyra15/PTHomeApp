import { Exercise } from '../types/exercise';

export const EXERCISES: Exercise[] = [
  {
    id: 'front-raise',
    title: 'Front Arm Raise',
    shortDescription: 'Lift your arm forward and up, then lower it.',
    instructions: [
      'Hold the phone gently in one hand, arm relaxed at your side.',
      'Keep still for a moment so the app can find your starting position.',
      'Slowly raise your straight arm forward and up toward shoulder height.',
      'Pause, then slowly lower your arm back down to your side.',
    ],
    sensorMode: 'tilt',
    diagram: 'raise-front',
    targetReps: 6,
    targetAngleDeg: 65,
    returnAngleDeg: 20,
    accentColor: '#2C5F8A',
  },
  {
    id: 'side-raise',
    title: 'Side Arm Raise',
    shortDescription: 'Lift your arm out to the side and up, then lower it.',
    instructions: [
      'Hold the phone gently in one hand, arm relaxed at your side.',
      'Keep still for a moment so the app can find your starting position.',
      'Slowly raise your straight arm out to the side, up toward shoulder height.',
      'Pause, then slowly lower your arm back down to your side.',
    ],
    sensorMode: 'tilt',
    diagram: 'raise-side',
    targetReps: 6,
    targetAngleDeg: 65,
    returnAngleDeg: 20,
    accentColor: '#6B4FA0',
  },
  {
    id: 'shoulder-circles',
    title: 'Shoulder Circles',
    shortDescription: 'Make one big, slow circle with your whole arm.',
    instructions: [
      'Hold the phone gently in one hand, arm relaxed at your side.',
      'Keep still for a moment so the app is ready.',
      'Slowly swing your whole straight arm in one big, smooth circle.',
      'Keep going at a slow, steady pace until the app tells you the circle is complete.',
    ],
    sensorMode: 'rotation',
    diagram: 'circle-shoulder',
    targetReps: 4,
    targetRotationDeg: 360,
    accentColor: '#B7791F',
  },
  {
    id: 'wrist-circles',
    title: 'Wrist Circles',
    shortDescription: 'Rotate just your wrist in a gentle circle.',
    instructions: [
      'Hold the phone loosely in your hand, elbow resting on a table or arm of a chair.',
      'Keep still for a moment so the app is ready.',
      'Slowly rotate your wrist in a smooth circle.',
      'Keep going at a slow, steady pace until the app tells you the circle is complete.',
    ],
    sensorMode: 'rotation',
    diagram: 'circle-wrist',
    targetReps: 6,
    targetRotationDeg: 360,
    accentColor: '#227A3D',
  },
];

export function getExerciseById(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}
