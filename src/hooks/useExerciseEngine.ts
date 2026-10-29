import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { Exercise, EnginePhase, SessionSummary, TiltLeg } from '../types/exercise';
import { playSound } from '../utils/sound';
import { speak } from '../utils/speech';
import { hapticLight, hapticSuccess, hapticWarning } from '../utils/haptics';

type Vector = { x: number; y: number; z: number };

/**
 * Task 2.4: sensor capture. Both the accelerometer and the gyroscope stream for the whole session at
 * SENSOR_HZ (50 Hz — the low end of the plan's 50–100 Hz target, and what expo-sensors sustains
 * comfortably on iPhone; see docs/project-plan/decisions/2.4-sensor-library.md). The achieved rate is
 * measured every second and saved with the session, so the library decision is backed by real data.
 *
 * React state is only updated ~12×/s (UI_INTERVAL_MS) even though samples arrive at 50 Hz, so the
 * screen doesn't re-render on every sample. Rep/flash/phase events are pushed immediately.
 */
export const SENSOR_HZ = 50;
const SAMPLE_INTERVAL_MS = Math.round(1000 / SENSOR_HZ);
const UI_INTERVAL_MS = 80;
const CALIBRATION_SECONDS = 3;
const REST_SECONDS = 30;
const TOO_FAST_DEG_PER_SEC = 220;
const TOO_FAST_COOLDOWN_MS = 4500;
const GYRO_NOISE_FLOOR_RAD_S = 0.06;
/** Low-pass filter strength for the accelerometer (0–1; lower = smoother). 0.25 at 50 Hz ≈ 6 Hz cutoff. */
const ACCEL_SMOOTHING = 0.25;
/** Live sparkline: one point every ~100 ms, last ~6 s. */
const TRACE_POINTS = 60;
const TRACE_EVERY_N_SAMPLES = Math.max(1, Math.round(SENSOR_HZ / 10));
const LOG_SENSOR_RATE = __DEV__;

export type FlashKind = 'target' | 'rep' | 'complete' | null;
export type PauseReason = 'user' | 'background' | null;

export interface EngineState {
  phase: EnginePhase;
  calibrationCountdown: number;
  restCountdown: number;
  /** Reps in the current set. */
  reps: number;
  targetReps: number;
  /** 1-based current set. */
  set: number;
  targetSets: number;
  totalReps: number;
  /** 0–1 progress through the current leg/lap — drives the color wash + diagram. */
  progress: number;
  leg: TiltLeg | null;
  /** Degrees used to pose the live diagram; meaning depends on the exercise's diagram kind. */
  diagramAngle: number;
  /** Peak angle of the last counted rep (tilt exercises). */
  lastRepRom: number | null;
  flash: FlashKind;
  tooFastNotice: boolean;
  pausedReason: PauseReason;
  /** Measured sample rates over the last second. */
  accelHz: number;
  gyroHz: number;
  /** Recent |accel| (g, gravity removed) and |gyro| (deg/s) for the live chart. */
  traceAccel: number[];
  traceGyro: number[];
}

function magnitude(v: Vector): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function vectorAngleDeg(a: Vector, b: Vector): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  const cos = Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y + a.z * b.z) / (magA * magB)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pushTrace(arr: number[], v: number): number[] {
  const next = arr.length >= TRACE_POINTS ? arr.slice(arr.length - TRACE_POINTS + 1) : arr.slice();
  next.push(v);
  return next;
}

const REP_WORDS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];

function speakRepCount(rep: number): void {
  speak(REP_WORDS[rep - 1] ?? String(rep));
}

export interface EngineOptions {
  sets?: number;
  reps?: number;
}

export function useExerciseEngine(exercise: Exercise, options: EngineOptions = {}) {
  const targetSets = Math.max(1, options.sets ?? 1);
  const targetReps = Math.max(1, options.reps ?? exercise.targetReps);

  const [state, setState] = useState<EngineState>({
    phase: 'checking-sensors',
    calibrationCountdown: CALIBRATION_SECONDS,
    restCountdown: REST_SECONDS,
    reps: 0,
    targetReps,
    set: 1,
    targetSets,
    totalReps: 0,
    progress: 0,
    leg: exercise.sensorMode === 'tilt' ? 'outbound' : null,
    diagramAngle: 0,
    lastRepRom: null,
    flash: null,
    tooFastNotice: false,
    pausedReason: null,
    accelHz: 0,
    gyroHz: 0,
    traceAccel: [],
    traceGyro: [],
  });

  // Mutable engine state the sensor callbacks read/write synchronously (never stale between renders).
  const engineRef = useRef({
    phase: 'checking-sensors' as EnginePhase,
    calibrationSamples: [] as Vector[],
    needsCalibration: true,
    baseline: null as Vector | null,
    filtered: null as Vector | null,
    cumulativeRotationDeg: 0,
    leg: 'outbound' as TiltLeg,
    reps: 0,
    set: 1,
    totalReps: 0,
    repPeak: 0,
    romPerRep: [] as number[],
    lastAngle: 0,
    lastSampleTime: 0,
    lastGyroTime: 0,
    speedEma: 0,
    lastTooFastAt: 0,
    activeMs: 0,
    activeSince: 0,
    pauses: 0,
    // rate measurement
    rateWindowStart: 0,
    accelCount: 0,
    gyroCount: 0,
    accelRates: [] as number[],
    gyroRates: [] as number[],
    traceCounter: 0,
    gyroTraceCounter: 0,
    traceAccel: [] as number[],
    traceGyro: [] as number[],
    // throttled UI
    pendingUi: {} as Partial<EngineState>,
    lastUiEmit: 0,
  });

  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooFastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Push state now (events) — also flushes any throttled values. */
  const emit = useCallback((partial: Partial<EngineState>) => {
    const eng = engineRef.current;
    const merged = { ...eng.pendingUi, ...partial };
    eng.pendingUi = {};
    eng.lastUiEmit = Date.now();
    setState((prev) => ({ ...prev, ...merged }));
  }, []);

  /** Queue continuous values (progress, angle, traces); flushed at most every UI_INTERVAL_MS. */
  const emitThrottled = useCallback(
    (partial: Partial<EngineState>) => {
      const eng = engineRef.current;
      Object.assign(eng.pendingUi, partial);
      if (Date.now() - eng.lastUiEmit >= UI_INTERVAL_MS) emit({});
    },
    [emit],
  );

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
      const eng = engineRef.current;
      eng.speedEma = eng.speedEma * 0.8 + degPerSec * 0.2; // smooth out single noisy samples
      const now = Date.now();
      if (eng.speedEma < TOO_FAST_DEG_PER_SEC) return;
      if (now - eng.lastTooFastAt < TOO_FAST_COOLDOWN_MS) return;
      eng.lastTooFastAt = now;
      hapticWarning();
      speak('Try moving a little slower and steadier.');
      emit({ tooFastNotice: true });
      if (tooFastTimeoutRef.current) clearTimeout(tooFastTimeoutRef.current);
      tooFastTimeoutRef.current = setTimeout(() => emit({ tooFastNotice: false }), 2500);
    },
    [emit],
  );

  const stopActiveClock = useCallback(() => {
    const eng = engineRef.current;
    if (eng.activeSince) eng.activeMs += Date.now() - eng.activeSince;
    eng.activeSince = 0;
  }, []);

  const beginActive = useCallback(() => {
    const eng = engineRef.current;
    eng.lastSampleTime = 0;
    eng.lastGyroTime = 0;
    eng.speedEma = 0;
    eng.activeSince = Date.now();
    eng.phase = 'active';
    emit({ phase: 'active', calibrationCountdown: 0, pausedReason: null });
  }, [emit]);

  const runCalibration = useCallback(() => {
    const eng = engineRef.current;
    eng.calibrationSamples = [];
    eng.phase = 'calibrating';
    let secondsLeft = CALIBRATION_SECONDS;
    emit({ phase: 'calibrating', calibrationCountdown: secondsLeft, pausedReason: null });

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
        eng.baseline = samples.length
          ? samples.reduce(
              (acc, s) => ({ x: acc.x + s.x / samples.length, y: acc.y + s.y / samples.length, z: acc.z + s.z / samples.length }),
              { x: 0, y: 0, z: 0 },
            )
          : { x: 0, y: 0, z: 1 };
        eng.filtered = eng.baseline;
      }
      eng.needsCalibration = false;
      beginActive();
    }, 1000);
  }, [beginActive, emit, exercise.sensorMode]);

  const finish = useCallback(() => {
    const eng = engineRef.current;
    stopActiveClock();
    eng.phase = 'finished';
    emit({ reps: eng.reps, totalReps: eng.totalReps, phase: 'finished', progress: 0 });
    playSound('exerciseComplete');
    speak('Great job! Exercise complete.');
    triggerFlash('complete', 1600);
  }, [emit, stopActiveClock, triggerFlash]);

  const startNextSet = useCallback(() => {
    const eng = engineRef.current;
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    eng.set += 1;
    eng.reps = 0;
    eng.leg = 'outbound';
    eng.cumulativeRotationDeg = 0;
    eng.repPeak = 0;
    speak(`Set ${eng.set}. Begin when you're ready.`);
    emit({ set: eng.set, reps: 0, progress: 0, leg: exercise.sensorMode === 'tilt' ? 'outbound' : null, restCountdown: REST_SECONDS });
    beginActive();
  }, [beginActive, emit, exercise.sensorMode]);

  const completeRep = useCallback(
    (rom: number | null) => {
      const eng = engineRef.current;
      eng.reps += 1;
      eng.totalReps += 1;
      if (rom !== null) eng.romPerRep.push(Math.round(rom));
      hapticSuccess();
      playSound('repComplete');
      triggerFlash('rep', 600);

      if (eng.reps < targetReps) {
        speakRepCount(eng.reps);
        emit({ reps: eng.reps, totalReps: eng.totalReps, progress: 0, lastRepRom: rom === null ? null : Math.round(rom) });
        return;
      }
      if (eng.set >= targetSets) {
        emit({ lastRepRom: rom === null ? null : Math.round(rom) });
        finish();
        return;
      }
      // set done -> rest
      stopActiveClock();
      eng.phase = 'rest';
      let left = REST_SECONDS;
      speak(`Set ${eng.set} done. Take a short rest.`);
      emit({ phase: 'rest', reps: eng.reps, totalReps: eng.totalReps, progress: 0, restCountdown: left });
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
      restIntervalRef.current = setInterval(() => {
        left -= 1;
        if (left > 0) emit({ restCountdown: left });
        else startNextSet();
      }, 1000);
    },
    [emit, finish, startNextSet, stopActiveClock, targetReps, targetSets, triggerFlash],
  );

  // 1. Check sensor availability once on mount.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const available =
          exercise.sensorMode === 'tilt' ? await Accelerometer.isAvailableAsync() : await Gyroscope.isAvailableAsync();
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

  // 2. Stream both sensors for the lifetime of the screen; behavior branches on the phase in engineRef.
  useEffect(() => {
    Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);
    Gyroscope.setUpdateInterval(SAMPLE_INTERVAL_MS);
    const eng = engineRef.current;
    eng.rateWindowStart = Date.now();

    const tickRate = (now: number) => {
      const elapsed = now - eng.rateWindowStart;
      if (elapsed < 1000) return;
      const aHz = Math.round((eng.accelCount * 1000) / elapsed);
      const gHz = Math.round((eng.gyroCount * 1000) / elapsed);
      if (eng.phase === 'active') {
        eng.accelRates.push(aHz);
        eng.gyroRates.push(gHz);
      }
      if (LOG_SENSOR_RATE && (eng.phase === 'active' || eng.phase === 'calibrating')) {
        console.log(`[sensors] accel ${aHz} Hz, gyro ${gHz} Hz (requested ${SENSOR_HZ} Hz)`);
      }
      eng.accelCount = 0;
      eng.gyroCount = 0;
      eng.rateWindowStart = now;
      emitThrottled({ accelHz: aHz, gyroHz: gHz });
    };

    const handleAccel = (sample: Vector) => {
      const now = Date.now();
      eng.accelCount += 1;
      tickRate(now);

      if (++eng.traceCounter % TRACE_EVERY_N_SAMPLES === 0 && (eng.phase === 'active' || eng.phase === 'calibrating')) {
        eng.traceAccel = pushTrace(eng.traceAccel, Math.abs(magnitude(sample) - 1));
        emitThrottled({ traceAccel: eng.traceAccel, traceGyro: eng.traceGyro });
      }
      if (exercise.sensorMode !== 'tilt') return;

      if (eng.phase === 'calibrating') {
        eng.calibrationSamples.push(sample);
        return;
      }
      if (eng.phase !== 'active' || !eng.baseline) return;

      const f = eng.filtered ?? sample;
      eng.filtered = {
        x: f.x + ACCEL_SMOOTHING * (sample.x - f.x),
        y: f.y + ACCEL_SMOOTHING * (sample.y - f.y),
        z: f.z + ACCEL_SMOOTHING * (sample.z - f.z),
      };
      const angle = vectorAngleDeg(eng.filtered, eng.baseline);
      const dtSec = eng.lastSampleTime ? (now - eng.lastSampleTime) / 1000 : 0;
      if (dtSec > 0) maybeWarnTooFast(Math.abs(angle - eng.lastAngle) / dtSec);
      eng.lastAngle = angle;
      eng.lastSampleTime = now;
      eng.repPeak = Math.max(eng.repPeak, angle);

      const target = exercise.targetAngleDeg ?? 60;
      const ret = exercise.returnAngleDeg ?? 20;
      const diagramAngle = clamp(angle, 0, exercise.diagram === 'dial' ? 180 : 90);

      if (eng.leg === 'outbound') {
        emitThrottled({ progress: clamp(angle / target, 0, 1), leg: 'outbound', diagramAngle });
        if (angle >= target) {
          eng.leg = 'inbound';
          hapticLight();
          playSound('ready');
          if (eng.reps === 0 && eng.set === 1) speak('Great. Now slowly bring it back.');
          triggerFlash('target', 400);
        }
      } else {
        const span = Math.max(1, target - ret);
        emitThrottled({ progress: clamp((target - angle) / span, 0, 1), leg: 'inbound', diagramAngle });
        if (angle <= ret) {
          eng.leg = 'outbound';
          const rom = eng.repPeak;
          eng.repPeak = 0;
          completeRep(rom);
        }
      }
    };

    const handleGyro = (sample: Vector) => {
      const now = Date.now();
      eng.gyroCount += 1;
      const magnitudeRadS = magnitude(sample);
      const degPerSec = (magnitudeRadS * 180) / Math.PI;
      if (++eng.gyroTraceCounter % TRACE_EVERY_N_SAMPLES === 0 && (eng.phase === 'active' || eng.phase === 'calibrating')) {
        eng.traceGyro = pushTrace(eng.traceGyro, degPerSec);
      }
      if (exercise.sensorMode !== 'rotation' || eng.phase !== 'active') return;

      const dtSec = eng.lastGyroTime ? Math.min(0.25, (now - eng.lastGyroTime) / 1000) : 0;
      eng.lastGyroTime = now;
      maybeWarnTooFast(degPerSec);
      if (magnitudeRadS > GYRO_NOISE_FLOOR_RAD_S && dtSec > 0) {
        eng.cumulativeRotationDeg += degPerSec * dtSec;
      }
      const target = exercise.targetRotationDeg ?? 360;
      emitThrottled({ progress: clamp(eng.cumulativeRotationDeg / target, 0, 1), diagramAngle: eng.cumulativeRotationDeg % 360 });
      if (eng.cumulativeRotationDeg >= target) {
        eng.cumulativeRotationDeg = Math.max(0, eng.cumulativeRotationDeg - target);
        completeRep(null);
      }
    };

    const accelSub = Accelerometer.addListener(handleAccel);
    const gyroSub = Gyroscope.addListener(handleGyro);

    return () => {
      accelSub.remove();
      gyroSub.remove();
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      if (tooFastTimeoutRef.current) clearTimeout(tooFastTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  const start = useCallback(() => {
    const eng = engineRef.current;
    Object.assign(eng, {
      baseline: null, filtered: null, cumulativeRotationDeg: 0, leg: 'outbound', reps: 0, set: 1, totalReps: 0,
      repPeak: 0, romPerRep: [], lastAngle: 0, activeMs: 0, activeSince: 0, pauses: 0,
      accelRates: [], gyroRates: [], traceAccel: [], traceGyro: [], needsCalibration: true,
    });
    emit({
      reps: 0, set: 1, totalReps: 0, progress: 0, leg: exercise.sensorMode === 'tilt' ? 'outbound' : null,
      diagramAngle: 0, flash: null, tooFastNotice: false, lastRepRom: null, traceAccel: [], traceGyro: [],
    });
    runCalibration();
  }, [emit, exercise.sensorMode, runCalibration]);

  /** Pause live tracking (Pause button, or automatically when the app is backgrounded — F05). */
  const pause = useCallback(
    (reason: Exclude<PauseReason, null> = 'user') => {
      const eng = engineRef.current;
      if (eng.phase === 'calibrating') {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        eng.needsCalibration = true;
      } else if (eng.phase !== 'active') {
        return;
      }
      stopActiveClock();
      eng.pauses += 1;
      eng.phase = 'paused';
      emit({ phase: 'paused', pausedReason: reason, tooFastNotice: false });
    },
    [emit, stopActiveClock],
  );

  /** Resume where the patient left off; re-runs the 3-second calibration only if it was interrupted. */
  const resume = useCallback(() => {
    const eng = engineRef.current;
    if (eng.phase !== 'paused') return;
    if (eng.needsCalibration) {
      runCalibration();
      return;
    }
    speak("Welcome back. Let's keep going.");
    beginActive();
  }, [beginActive, runCalibration]);

  const skipRest = useCallback(() => {
    if (engineRef.current.phase === 'rest') startNextSet();
  }, [startNextSet]);

  // Auto-pause when the app goes to the background (phone call, home button) — task 2.4 DoD.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') pause('background');
    });
    return () => sub.remove();
  }, [pause]);

  /** Snapshot of the session so far; call when finished, or to end early (marks it incomplete). */
  const getSummary = useCallback((): SessionSummary => {
    const eng = engineRef.current;
    const activeMs = eng.activeMs + (eng.activeSince ? Date.now() - eng.activeSince : 0);
    const roms = eng.romPerRep;
    const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
    const done = eng.set >= targetSets && eng.reps >= targetReps;
    const setsCompleted = done ? targetSets : eng.set - 1;
    return {
      exerciseId: exercise.id,
      completed: done,
      repsCompleted: eng.totalReps,
      setsCompleted,
      targetSets,
      targetReps,
      durationSeconds: Math.round(activeMs / 1000),
      romPerRep: roms,
      avgRomDeg: avg(roms),
      peakRomDeg: roms.length ? Math.max(...roms) : null,
      accelHz: avg(eng.accelRates),
      gyroHz: avg(eng.gyroRates),
      requestedHz: SENSOR_HZ,
      pauses: eng.pauses,
    };
  }, [exercise.id, targetReps, targetSets]);

  /** Stop tracking now (End exercise). Returns the partial summary. */
  const endEarly = useCallback((): SessionSummary => {
    const eng = engineRef.current;
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    stopActiveClock();
    eng.phase = 'finished';
    return getSummary();
  }, [getSummary, stopActiveClock]);

  return { state, start, pause, resume, skipRest, endEarly, getSummary };
}
