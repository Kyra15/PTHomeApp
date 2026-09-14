import * as Speech from 'expo-speech';

/** Speak a short cue. Slightly slower than default for clarity. */
export function speak(text: string, rate: number = 0.9): void {
  try {
    Speech.stop();
    Speech.speak(text, { rate, pitch: 1.0 });
  } catch (e) {
    console.warn('Speech failed', e);
  }
}

export function stopSpeaking(): void {
  try {
    Speech.stop();
  } catch {
    // no-op
  }
}
