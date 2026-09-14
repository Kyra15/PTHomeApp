import { useCallback, useEffect, useRef, useState } from 'react';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { Exercise, EnginePhase, TiltLeg } from '../types/exercise';
import { playSound } from '../utils/sound';
import { speak } from '../utils/speech';
import { hapticLight, hapticSuccess, hapticWarning } from '../utils/haptics';

type Vector = { x: number; y: number; z: number };

const SAMPLE_INTERVAL_MS = 100; // 10Hz — plenty for human-speed movement, gentle on battery/CPU.
const CALIBRATION_SECONDS = 3;
const TOO_FAST_DEG_PER_SEC = 220;
const TOO_FAST_COOLDOWN_MS = 4500;
const GYRO_NOISE_FLOOR_RAD_S = 0.06;

export type FlashKind = 'target' | 'rep' | 'complete' | null;

export interface EngineState {
  phase: EnginePhase;
  calibrationCountdown: number;
  reps: number;
  targetReps: number;
  /** 0–1 progress through the current leg/lap — drives the color wash + diagram. */
  progress: number;
  leg: TiltLeg | null;
  /** Degrees used to pose the live diagram; meaning depends on the exercise's diagram kind. */
  diagramAngle: number;
  flash: FlashKind;
  tooFastNotice: boolean;
}

function vectorAngleDeg(a: Vector, b: Vector): number {
  const dot = a.x * b.x + a.y * b.y + a.z * b.z;
  const magA = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
  const magB = Math.sqrt(b.x * b.x + b.y * b.y + b.z * b.z);
  if (magA === 0 || magB === 0) return 0;
  let cos = dot / (magA * magB);
  cos = Math.max(-1, Math.min(1, cos));
  return (Math.acos(cos) * 180) / Math.PI;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const REP_WORDS = [
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
];

function speakRepCount(rep: number): void {
  speak(REP_WORDS[rep - 1] ?? String(rep));
}

export function useExerciseEngine(exercise: Exercise) {
  const [state, setState] = useState<EngineState>({
    phase: 'checking-sensors',
    calibrationCountdown: CALIBRATION_SECONDS,
    reps: 0,
    targetReps: exercise.targetReps,
    progress: 0,
    leg: exercise.sensorMode === 'tilt' ? 'outbound' : null,
    diagramAngle: 0,
    flash: null,
    tooFastNotice: false,
  });

  // Mutable engine state that the sensor callback reads/writes synchronously,
  // so the closure never works with stale values from a React re-render.
  const engineRef = useRef({
    phase: 'checking-sensors' as EnginePhase,
    calibrationSamples: [] as Vector[],
    baseline: null as Vector | null,
    cumulativeRotationDeg: 0,
    leg: 'outbound' as TiltLeg,
    reps: 0,
    lastAngle: 0,
    lastSampleTime: 0,
    lastTooFastAt: 0,
  });

  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooFastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const emit = useCallback((partial: Partial<EngineState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const triggerFlash = useCallback(
    (kind: FlashKind, durationMs: number) => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      emit({ flash: kind });
      flashTimeoutRef.current = setTimeout(() => emit({ flash: null }), durationMs);
    },
    [emit],
  );

  const maybeWarnTooFast = useCallback(
    (degPerSec: number) => {
      const now = Date.now();
      if (degPerSec < TOO_FAST_DEG_PER_SEC) return;
      if (now - engineRef.current.lastTooFastAt < TOO_FAST_COOLDOWN_MS) return;
      engineRef.current.lastTooFastAt = now;
      hapticWarning();
      speak('Try moving a little slower and steadier.');
      emit({ tooFastNotice: true });
      if (tooFastTimeoutRef.current) clearTimeout(tooFastTimeoutRef.current);
      tooFastTimeoutRef.current = setTimeout(() => emit({ tooFastNotice: false }), 2500);
    },
    [emit],
  );

  // 1. Check sensor availability once on mount.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const available =
          exercise.sensorMode === 'tilt'
            ? await Accelerometer.isAvailableAsync()
            : await Gyroscope.isAvailableAsync();
        if (!mounted) return;
        const phase: EnginePhase = available ? 'intro' : 'sensors-unavailable';
        engineRef.current.phase = phase;
        emit({ phase });
      } catch {
        if (!mounted) return;
        engineRef.current.phase = 'sensors-unavailable';
        emit({ phase: 'sensors-unavailable' });
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  // 2. Subscribe to the sensor for the lifetime of this screen; behavior
  //    branches internally based on the current phase/leg held in engineRef.
  useEffect(() => {
    Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);
    Gyroscope.setUpdateInterval(SAMPLE_INTERVAL_MS);

    const handleTiltSample = (sample: Vector) => {
      const eng = engineRef.current;
      if (eng.phase === 'calibrating') {
        eng.calibrationSamples.push(sample);
        return;
      }
      if (eng.phase !== 'active' || !eng.baseline) return;

      const now = Date.now();
      const angle = vectorAngleDeg(sample, eng.baseline);
      const dtSec = eng.lastSampleTime ? (now - eng.lastSampleTime) / 1000 : 0;
      const degPerSec = dtSec > 0 ? Math.abs(angle - eng.lastAngle) / dtSec : 0;
      eng.lastAngle = angle;
      eng.lastSampleTime = now;
      maybeWarnTooFast(degPerSec);

      const target = exercise.targetAngleDeg ?? 60;
      const ret = exercise.returnAngleDeg ?? 20;
      const diagramAngle = clamp(angle, 0, 90);

      if (eng.leg === 'outbound') {
        const progress = clamp(angle / target, 0, 1);
        emit({ progress, leg: 'outbound', diagramAngle });
        if (angle >= target) {
          eng.leg = 'inbound';
          hapticLight();
          playSound('ready');
          if (eng.reps === 0) {
            speak('Great. Now slowly lower it back down.');
          }
          triggerFlash('target', 400);
        }
      } else {
        const span = Math.max(1, target - ret);
        const progress = clamp((target - angle) / span, 0, 1);
        emit({ progress, leg: 'inbound', diagramAngle });
        if (angle <= ret) {
          eng.leg = 'outbound';
          eng.reps += 1;
          hapticSuccess();
          playSound('repComplete');
          speakRepCount(eng.reps);
          triggerFlash('rep', 600);
          if (eng.reps >= exercise.targetReps) {
            eng.phase = 'finished';
            emit({ reps: eng.reps, phase: 'finished', progress: 0 });
            playSound('exerciseComplete');
            speak('Great job! Exercise complete.');
            triggerFlash('complete', 1600);
          } else {
            emit({ reps: eng.reps, progress: 0 });
          }
        }
      }
    };

    const handleRotationSample = (sample: Vector) => {
      const eng = engineRef.current;
      if (eng.phase !== 'active') return;

      const now = Date.now();
      const dtSec = eng.lastSampleTime ? (now - eng.lastSampleTime) / 1000 : 0;
      eng.lastSampleTime = now;

      const magnitudeRadS = Math.sqrt(sample.x * sample.x + sample.y * sample.y + sample.z * sample.z);
      const degPerSec = (magnitudeRadS * 180) / Math.PI;
      maybeWarnTooFast(degPerSec);

      if (magnitudeRadS > GYRO_NOISE_FLOOR_RAD_S && dtSec > 0) {
        eng.cumulativeRotationDeg += degPerSec * dtSec;
      }

      const target = exercise.targetRotationDeg ?? 360;
      const progress = clamp(eng.cumulativeRotationDeg / target, 0, 1);
      const diagramAngle = eng.cumulativeRotationDeg % 360;
      emit({ progress, diagramAngle });

      if (eng.cumulativeRotationDeg >= target) {
        eng.cumulativeRotationDeg = Math.max(0, eng.cumulativeRotationDeg - target);
        eng.reps += 1;
        hapticSuccess();
        playSound('repComplete');
        speakRepCount(eng.reps);
        triggerFlash('rep', 600);
        if (eng.reps >= exercise.targetReps) {
          eng.phase = 'finished';
          emit({ reps: eng.reps, phase: 'finished', progress: 0 });
          playSound('exerciseComplete');
          speak('Great job! Exercise complete.');
          triggerFlash('complete', 1600);
        } else {
          emit({ reps: eng.reps });
        }
      }
    };

    const accelSub =
      exercise.sensorMode === 'tilt' ? Accelerometer.addListener(handleTiltSample) : null;
    const gyroSub =
      exercise.sensorMode === 'rotation' ? Gyroscope.addListener(handleRotationSample) : null;

    return () => {
      accelSub?.remove();
      gyroSub?.remove();
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      if (tooFastTimeoutRef.current) clearTimeout(tooFastTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  const start = useCallback(() => {
    const eng = engineRef.current;
    eng.calibrationSamples = [];
    eng.baseline = null;
    eng.cumulativeRotationDeg = 0;
    eng.leg = 'outbound';
    eng.reps = 0;
    eng.lastAngle = 0;
    eng.lastSampleTime = 0;
    eng.phase = 'calibrating';

    let secondsLeft = CALIBRATION_SECONDS;
    emit({
      phase: 'calibrating',
      calibrationCountdown: secondsLeft,
      reps: 0,
      progress: 0,
      leg: exercise.sensorMode === 'tilt' ? 'outbound' : null,
      diagramAngle: 0,
      flash: null,
      tooFastNotice: false,
    });

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft > 0) {
        emit({ calibrationCountdown: secondsLeft });
        return;
      }
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

      if (exercise.sensorMode === 'tilt') {
        const samples = eng.calibrationSamples;
        const avg = samples.reduce(
          (acc, s) => ({ x: acc.x + s.x / samples.length, y: acc.y + s.y / samples.length, z: acc.z + s.z / samples.length }),
          { x: 0, y: 0, z: 0 },
        );
        eng.baseline = samples.length > 0 ? avg : { x: 0, y: 0, z: 1 };
      }

      eng.lastSampleTime = Date.now();
      eng.phase = 'active';
      emit({ phase: 'active', calibrationCountdown: 0 });
    }, 1000);
  }, [emit, exercise.sensorMode]);

  const restart = useCallback(() => {
    start();
  }, [start]);

  return { state, start, restart };
}
