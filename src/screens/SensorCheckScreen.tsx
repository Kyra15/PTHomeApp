import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import Constants from 'expo-constants';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { BigButton } from '../components/BigButton';
import { colors, radii, spacing, type } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SensorCheck'>;

const RUN_SECONDS = 10;

interface SensorResult {
  hz: number;
  meanIntervalMs: number;
  jitterMs: number;
  maxGapMs: number;
  /** % of intervals within 1.5× the requested interval. */
  onTimePct: number;
}

interface RunResult {
  requestedHz: number;
  accel: SensorResult;
  gyro: SensorResult;
}

function analyze(times: number[], requestedHz: number, seconds: number): SensorResult {
  const gaps = times.slice(1).map((t, i) => t - times[i]);
  const mean = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const sd = gaps.length ? Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length) : 0;
  const limit = (1000 / requestedHz) * 1.5;
  return {
    hz: Math.round(times.length / seconds),
    meanIntervalMs: Math.round(mean * 10) / 10,
    jitterMs: Math.round(sd * 10) / 10,
    maxGapMs: gaps.length ? Math.round(Math.max(...gaps)) : 0,
    onTimePct: gaps.length ? Math.round((100 * gaps.filter((g) => g <= limit).length) / gaps.length) : 0,
  };
}

/**
 * Task 2.4: evaluate expo-sensors against the target sample rate ON A REAL iPHONE. Streams the
 * accelerometer and gyroscope together (like a live session) for 10 s at 50 Hz and at 100 Hz and
 * reports the achieved rate, timing jitter and longest gap. Screenshot the result into
 * docs/project-plan/decisions/2.4-sensor-library.md.
 */
export function SensorCheckScreen({ navigation }: Props) {
  useKeepAwake();
  const [running, setRunning] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [results, setResults] = useState<RunResult[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const subs = useRef<{ remove: () => void }[]>([]);

  useEffect(() => () => subs.current.forEach((s) => s.remove()), []);

  const run = async (hz: number) => {
    const [aOk, gOk] = await Promise.all([Accelerometer.isAvailableAsync(), Gyroscope.isAvailableAsync()]);
    if (!aOk || !gOk) {
      setUnavailable(true);
      return;
    }
    const a: number[] = [];
    const g: number[] = [];
    Accelerometer.setUpdateInterval(1000 / hz);
    Gyroscope.setUpdateInterval(1000 / hz);
    setRunning(hz);
    setSecondsLeft(RUN_SECONDS);
    // Use the JS receive time: that's what the rep counter actually experiences across the bridge.
    subs.current = [Accelerometer.addListener(() => a.push(Date.now())), Gyroscope.addListener(() => g.push(Date.now()))];
    const tick = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    setTimeout(() => {
      clearInterval(tick);
      subs.current.forEach((s) => s.remove());
      subs.current = [];
      const result = { requestedHz: hz, accel: analyze(a, hz, RUN_SECONDS), gyro: analyze(g, hz, RUN_SECONDS) };
      console.log('[sensor-check]', JSON.stringify(result));
      setResults((r) => [...r.filter((x) => x.requestedHz !== hz), result]);
      setRunning(null);
    }, RUN_SECONDS * 1000);
  };

  const model = Constants.deviceName ?? 'this phone';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Motion Sensor Check</Text>
        <Text style={styles.body}>
          Set the phone down on a table and tap a test. It listens to both motion sensors for {RUN_SECONDS} seconds and
          shows how steadily the readings arrive.
        </Text>
        {unavailable && (
          <View style={[styles.card, { borderColor: colors.danger }]}>
            <Text style={styles.cardTitle}>Sensors not available</Text>
            <Text style={styles.body}>This needs a real iPhone — simulators have no motion sensors.</Text>
          </View>
        )}
        {running ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Testing {running} Hz…</Text>
            <Text style={styles.big}>{Math.max(0, secondsLeft)}</Text>
          </View>
        ) : null}
        {results
          .sort((x, y) => x.requestedHz - y.requestedHz)
          .map((r) => {
            const pass = r.accel.hz >= r.requestedHz * 0.9 && r.gyro.hz >= r.requestedHz * 0.9;
            return (
              <View key={r.requestedHz} style={[styles.card, { borderColor: pass ? colors.motionSuccess : colors.danger }]}>
                <Text style={styles.cardTitle}>
                  {r.requestedHz} Hz requested — {pass ? 'OK ✓' : 'too slow ✕'}
                </Text>
                {(['accel', 'gyro'] as const).map((k) => (
                  <Text key={k} style={styles.mono}>
                    {k === 'accel' ? 'Accelerometer' : 'Gyroscope    '}: {r[k].hz} Hz · avg {r[k].meanIntervalMs} ms · jitter{' '}
                    {r[k].jitterMs} ms · max gap {r[k].maxGapMs} ms · {r[k].onTimePct}% on time
                  </Text>
                ))}
              </View>
            );
          })}
        <Text style={styles.caption}>Device: {model}. Results are also printed to the Metro console.</Text>
      </ScrollView>
      <View style={styles.buttons}>
        <BigButton label="Test 50 Hz" onPress={() => run(50)} disabled={running !== null} />
        <BigButton label="Test 100 Hz" variant="secondary" onPress={() => run(100)} disabled={running !== null} />
        <BigButton label="Done" variant="outline" onPress={() => navigation.goBack()} disabled={running !== null} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { ...type.h1, color: colors.textPrimary, marginBottom: spacing.sm },
  body: { ...type.body, color: colors.textSecondary, marginBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 2, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  cardTitle: { ...type.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  big: { ...type.giant, color: colors.primary, textAlign: 'center' },
  mono: { ...type.caption, fontSize: 16, color: colors.textPrimary, fontFamily: 'Menlo', marginTop: 4 },
  caption: { ...type.caption, color: colors.textSecondary },
  buttons: { gap: spacing.sm, padding: spacing.lg, paddingTop: spacing.sm },
});
