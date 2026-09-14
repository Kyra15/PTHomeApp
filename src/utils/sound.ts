import { createAudioPlayer, setAudioModeAsync, AudioPlayer, AudioSource } from 'expo-audio';

export type SoundName = 'ready' | 'repComplete' | 'exerciseComplete' | 'gentleAlert';

const SOURCES: Record<SoundName, AudioSource> = {
  ready: require('../../assets/sounds/ready-cue.wav'),
  repComplete: require('../../assets/sounds/rep-complete.wav'),
  exerciseComplete: require('../../assets/sounds/exercise-complete.wav'),
  gentleAlert: require('../../assets/sounds/gentle-alert.wav'),
};

const cache = new Map<SoundName, AudioPlayer>();
let audioModeSet = false;

async function ensureAudioMode(): Promise<void> {
  if (audioModeSet) return;
  audioModeSet = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
    });
  } catch (e) {
    console.warn('Failed to set audio mode', e);
  }
}

function getSound(name: SoundName): AudioPlayer {
  const cached = cache.get(name);
  if (cached) return cached;

  // createAudioPlayer synchronously creates the player instance in expo-audio
  const player = createAudioPlayer(SOURCES[name]);
  cache.set(name, player);
  return player;
}

/** Warm the cache so the very first cue during an exercise isn't delayed. */
export async function preloadSounds(): Promise<void> {
  await ensureAudioMode();
  (Object.keys(SOURCES) as SoundName[]).forEach((n) => {
    try {
      getSound(n);
    } catch (e) {
      console.warn('Failed to preload sound', n, e);
    }
  });
}

export async function playSound(name: SoundName): Promise<void> {
  try {
    await ensureAudioMode();
    const player = getSound(name);
    
    // Reset audio position to start and play
    player.seekTo(0);
    player.play();
  } catch (e) {
    // A missing sound should never interrupt an exercise session.
    console.warn('Failed to play sound', name, e);
  }
}

export async function unloadSounds(): Promise<void> {
  cache.forEach((player) => {
    try {
      player.release();
    } catch (e) {
      console.warn('Failed to release sound player', e);
    }
  });
  cache.clear();
}