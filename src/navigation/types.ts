import type { SessionSummary } from '../types/exercise';

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
};

export type RootStackParamList = {
  Dashboard: undefined;
  Home: undefined; // exercise library (browse + practice any exercise)
  /** planId/sets/reps come from the patient's program; without them it's a practice run (not saved). */
  Exercise: { exerciseId: string; planId?: string; sets?: number; reps?: number };
  Complete: { summary: SessionSummary; planId?: string };
  SensorCheck: undefined; // task 2.4: measure achieved accelerometer/gyroscope rates on this phone
  Connect: { code?: string } | undefined; // accept a doctor invitation (in-app card, typed code, or invite link)
};
