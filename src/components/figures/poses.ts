/**
 * Person figures for the exercise demo / live diagrams.
 *
 * Pure geometry, no React: each exercise slug maps to a function that takes the current motion and returns
 * a list of simple shapes (lines, circles, filled polygons, dashed guides) in a 300 × 300 box. MotionDiagram
 * turns those into react-native-svg elements; scripts can render the same shapes to SVG for checking.
 *
 * Conventions
 *   - Angles: 0° points straight DOWN, 90° points RIGHT, 180° UP, 270° LEFT (so "from the side" figures face
 *     right and positive angles swing a limb forward/up).
 *   - `t` is progress toward the exercise's target: 0 = start position, 1 = target reached (may go a bit past).
 *   - `theta` is the position around a loop, 0–360°, for the circle exercises.
 *   - Tones: 'body' = the person, 'far' = the limb on the far side (dimmer), 'move' = the part doing the
 *     exercise (bright), 'prop' = furniture, 'guide' = dashed path of the motion, 'phone' = where the phone is.
 */

export interface Pt {
  x: number;
  y: number;
}

export type Tone = 'body' | 'far' | 'move' | 'prop' | 'guide' | 'phone';

export type Shape =
  | { kind: 'line'; a: Pt; b: Pt; w: number; tone: Tone }
  | { kind: 'circle'; c: Pt; r: number; tone: Tone }
  | { kind: 'poly'; pts: Pt[]; tone: Tone }
  /** stroked path (dashed when tone = 'guide') */
  | { kind: 'path'; d: string; w: number; tone: Tone }
  | { kind: 'text'; p: Pt; text: string; tone: Tone };

export interface Figure {
  shapes: Shape[];
  /** viewBox override when the motion needs more room than 0 0 300 300 */
  viewBox?: [number, number, number, number];
}

export interface Motion {
  /** 0 → 1 progress toward the target (out-and-back exercises) */
  t: number;
  /** 0 → 360 position around the loop (circle exercises) */
  theta: number;
}

// ---------- geometry helpers ----------
const rad = (deg: number) => (deg * Math.PI) / 180;
const p = (x: number, y: number): Pt => ({ x, y });
/** vector of length `len` pointing at `deg` (0 = down, 90 = right, 180 = up) */
const vec = (len: number, deg: number): Pt => p(len * Math.sin(rad(deg)), len * Math.cos(rad(deg)));
const add = (a: Pt, b: Pt): Pt => p(a.x + b.x, a.y + b.y);
const at = (from: Pt, len: number, deg: number) => add(from, vec(len, deg));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpPt = (a: Pt, b: Pt, k: number) => p(lerp(a.x, b.x, k), lerp(a.y, b.y, k));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Two-bone IK: where the middle joint (knee / elbow) goes so that a→joint is l1 and joint→c is l2.
 * `bend` picks the side: +1 bends toward +x (a knee in front of a figure facing right), -1 toward -x;
 * for nearly horizontal limbs use 'up' / 'down'.
 */
function ik(a: Pt, c: Pt, l1: number, l2: number, bend: 1 | -1 | 'up' | 'down'): Pt {
  const dx = c.x - a.x;
  const dy = c.y - a.y;
  const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const A = Math.acos(cosA);
  const base = Math.atan2(dy, dx);
  const j1 = p(a.x + l1 * Math.cos(base + A), a.y + l1 * Math.sin(base + A));
  const j2 = p(a.x + l1 * Math.cos(base - A), a.y + l1 * Math.sin(base - A));
  if (bend === 'up') return j1.y < j2.y ? j1 : j2;
  if (bend === 'down') return j1.y > j2.y ? j1 : j2;
  return (j1.x - j2.x) * bend > 0 ? j1 : j2;
}

/** A filled rectangle of width w and length h starting at `from` and running along `deg`. */
function bar(from: Pt, deg: number, len: number, w: number): Pt[] {
  const along = vec(len, deg);
  const side = vec(w / 2, deg + 90);
  return [
    add(from, side),
    add(add(from, along), side),
    add(add(from, along), p(-side.x, -side.y)),
    add(from, p(-side.x, -side.y)),
  ];
}

function ellipsePts(c: Pt, rx: number, ry: number, rotDeg = 0, n = 28): Pt[] {
  const out: Pt[] = [];
  const cr = Math.cos(rad(rotDeg));
  const sr = Math.sin(rad(rotDeg));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = rx * Math.cos(a);
    const y = ry * Math.sin(a);
    out.push(p(c.x + x * cr - y * sr, c.y + x * sr + y * cr));
  }
  return out;
}

const ptsToPath = (pts: Pt[], close = true) =>
  pts.map((q, i) => `${i ? 'L' : 'M'} ${r1(q.x)} ${r1(q.y)}`).join(' ') + (close ? ' Z' : '');

/** Dashed arc around `c` from angle a0 to a1 (same angle convention as vec). */
function arcGuide(c: Pt, r: number, a0: number, a1: number): Shape {
  const steps = Math.max(6, Math.round(Math.abs(a1 - a0) / 8));
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) pts.push(at(c, r, lerp(a0, a1, i / steps)));
  return { kind: 'path', d: ptsToPath(pts, false), w: 3, tone: 'guide' };
}

function ellipseGuide(c: Pt, rx: number, ry: number, rot = 0): Shape {
  return { kind: 'path', d: ptsToPath(ellipsePts(c, rx, ry, rot, 36)), w: 3, tone: 'guide' };
}

// ---------- drawing kit ----------
const LIMB = 12;
const TORSO_SIDE = 20;
const HEAD_R = 19;
// segment lengths
const UPPER_ARM = 50;
const FOREARM = 46;
const THIGH = 60;
const SHIN = 58;
const FOOT = 22;
const TORSO = 84;
const NECK = 24; // neck point → head centre
const GROUND = 272;
/** hip height for a person standing with nearly straight knees */
const STAND_HIP_Y = GROUND - 4 - (THIGH + SHIN) + 3;

class Sketch {
  shapes: Shape[] = [];
  line(a: Pt, b: Pt, tone: Tone = 'body', w = LIMB) {
    this.shapes.push({ kind: 'line', a, b, w, tone });
    return this;
  }
  chain(pts: Pt[], tone: Tone = 'body', w = LIMB) {
    for (let i = 1; i < pts.length; i++) this.line(pts[i - 1], pts[i], tone, w);
    return this;
  }
  circle(c: Pt, r: number, tone: Tone = 'body') {
    this.shapes.push({ kind: 'circle', c, r, tone });
    return this;
  }
  poly(pts: Pt[], tone: Tone = 'body') {
    this.shapes.push({ kind: 'poly', pts, tone });
    return this;
  }
  guide(s: Shape) {
    this.shapes.push(s);
    return this;
  }
  text(x: number, y: number, text: string) {
    this.shapes.push({ kind: 'text', p: p(x, y), text, tone: 'guide' });
    return this;
  }
  /** The phone: a small rounded slab of length 24 centred at c, its long side along `deg`. */
  phone(c: Pt, deg: number) {
    const start = at(c, 12, deg + 180);
    return this.poly(bar(start, deg, 24, 13), 'phone');
  }
  ground(x0 = 20, x1 = 280) {
    return this.line(p(x0, GROUND + 6), p(x1, GROUND + 6), 'prop', 4);
  }
  head(c: Pt, faceDeg?: number, tone: Tone = 'body') {
    this.circle(c, HEAD_R, tone);
    // a small nose shows which way the person faces
    if (faceDeg !== undefined) this.circle(at(c, HEAD_R + 2, faceDeg), 5, tone);
    return this;
  }
  /** side-view foot from the ankle, pointing along `deg` (90 = forward) */
  foot(ankle: Pt, deg = 90, tone: Tone = 'body') {
    return this.line(ankle, at(ankle, FOOT, deg), tone, 10);
  }
  /** chair seen from the side, seat at height seatY, seat front at x */
  chairSide(backX: number, frontX: number, seatY: number, backTop = seatY - 80) {
    this.line(p(backX, seatY), p(frontX, seatY), 'prop', 9);
    this.line(p(backX, seatY), p(backX - 4, backTop), 'prop', 9);
    this.line(p(backX + 2, seatY), p(backX + 2, GROUND + 4), 'prop', 6);
    this.line(p(frontX - 4, seatY), p(frontX - 4, GROUND + 4), 'prop', 6);
    return this;
  }
  /** table / counter seen from the side: top at y from x0 to x1, one leg at legX */
  tableSide(x0: number, x1: number, y: number, legX: number) {
    this.line(p(x0, y), p(x1, y), 'prop', 9);
    this.line(p(legX, y), p(legX, GROUND + 4), 'prop', 7);
    return this;
  }
  mat(x0: number, x1: number, y: number, h = 10) {
    return this.poly([p(x0, y), p(x1, y), p(x1, y + h), p(x0, y + h)], 'prop');
  }
  done(viewBox?: Figure['viewBox']): Figure {
    return { shapes: this.shapes, viewBox };
  }
}

/** Joints of a side-view person facing right. */
interface Side {
  hip: Pt;
  neck: Pt;
  head: Pt;
  shoulder: Pt;
}

/** Torso from the hip at `deg` (180 = upright). */
function sideTorso(hip: Pt, deg = 180): Side {
  const neck = at(hip, TORSO, deg);
  return { hip, neck, head: at(neck, NECK, deg), shoulder: at(hip, TORSO - 8, deg) };
}

function drawTorso(s: Sketch, b: Side, tone: Tone = 'body', faceDeg = 90) {
  s.line(b.hip, b.neck, tone, TORSO_SIDE);
  s.head(b.head, faceDeg, tone);
}

/** Standing legs, side view: ankle placed under the hip-ish, knee by IK. */
function standingLeg(hip: Pt, ankle: Pt): Pt[] {
  return [hip, ik(hip, ankle, THIGH, SHIN, 1), ankle];
}

// ---------- front-view kit ----------
interface Front {
  neck: Pt;
  head: Pt;
  lSh: Pt; // screen-left shoulder
  rSh: Pt; // screen-right shoulder
  lHip: Pt;
  rHip: Pt;
}

/** Front (or back) view torso: hip centre, lean angle (180 = upright, <180 leans to screen-right). */
function frontTorso(hipC: Pt, deg = 180, hipW = 26, shW = 50): Front {
  const neck = at(hipC, TORSO, deg);
  const across = vec(1, deg + 90); // perpendicular, pointing screen-left when upright
  const sh = at(hipC, TORSO - 8, deg);
  return {
    neck,
    head: at(neck, NECK, deg),
    lSh: add(sh, p(across.x * (shW / 2), across.y * (shW / 2))),
    rSh: add(sh, p(-across.x * (shW / 2), -across.y * (shW / 2))),
    lHip: p(hipC.x - hipW / 2, hipC.y),
    rHip: p(hipC.x + hipW / 2, hipC.y),
  };
}

function drawFrontTorso(s: Sketch, f: Front, tone: Tone = 'body') {
  const pad = (q: Pt, toward: Pt, k: number) => lerpPt(q, toward, k);
  s.poly(
    [
      pad(f.lSh, f.rSh, -0.06),
      pad(f.rSh, f.lSh, -0.06),
      p(f.rHip.x + 6, f.rHip.y + 4),
      p(f.lHip.x - 6, f.lHip.y + 4),
    ],
    tone,
  );
  s.line(f.neck, lerpPt(f.lSh, f.rSh, 0.5), tone, 14);
  s.circle(f.head, HEAD_R + 1, tone);
}

// ---------- the exercises ----------
type Builder = (m: Motion) => Figure;

/** Standing, side view, facing right — shared by the arm exercises. */
function standingSide(s: Sketch) {
  const hip = p(140, STAND_HIP_Y);
  const b = sideTorso(hip);
  const ankleFar = p(130, GROUND - 4);
  const ankleNear = p(146, GROUND - 4);
  s.ground(70, 230);
  s.chain(standingLeg(hip, ankleFar), 'far').foot(ankleFar, 90, 'far');
  return { b, hip, ankleNear };
}

const shoulderFlexion: Builder = ({ t }) => {
  const s = new Sketch();
  const { b, hip, ankleNear } = standingSide(s);
  s.chain([b.shoulder, at(b.shoulder, UPPER_ARM, 3), at(b.shoulder, UPPER_ARM + FOREARM, 3)], 'far');
  drawTorso(s, b);
  s.chain(standingLeg(hip, ankleNear)).foot(ankleNear);
  const a = clamp(t, 0, 1.15) * 90;
  s.guide(arcGuide(b.shoulder, UPPER_ARM + FOREARM + 14, 6, 92));
  const hand = at(b.shoulder, UPPER_ARM + FOREARM, a);
  s.line(b.shoulder, hand, 'move');
  s.phone(at(hand, -2, a), a);
  return s.done();
};

const elbowFlexion: Builder = ({ t }) => {
  const s = new Sketch();
  const { b, hip, ankleNear } = standingSide(s);
  s.chain([b.shoulder, at(b.shoulder, UPPER_ARM, -4), at(b.shoulder, UPPER_ARM + FOREARM, -4)], 'far');
  drawTorso(s, b);
  s.chain(standingLeg(hip, ankleNear)).foot(ankleNear);
  const elbow = at(b.shoulder, UPPER_ARM, 4);
  s.line(b.shoulder, elbow);
  const a = clamp(t, 0, 1.1) * 125;
  s.guide(arcGuide(elbow, FOREARM + 14, 6, 128));
  const hand = at(elbow, FOREARM, a);
  s.line(elbow, hand, 'move');
  s.phone(hand, a);
  return s.done();
};

const shoulderCircles: Builder = ({ theta }) => {
  const s = new Sketch();
  const { b, hip, ankleNear } = standingSide(s);
  s.chain([b.shoulder, at(b.shoulder, UPPER_ARM + FOREARM, -4)], 'far');
  drawTorso(s, b);
  s.chain(standingLeg(hip, ankleNear)).foot(ankleNear);
  const len = UPPER_ARM + FOREARM;
  s.guide(ellipseGuide(b.shoulder, len, len));
  const hand = at(b.shoulder, len, theta);
  s.line(b.shoulder, hand, 'move');
  s.phone(hand, theta);
  return s.done([-12, -34, 324, 324]);
};

const shoulderAbduction: Builder = ({ t }) => {
  const s = new Sketch();
  const hipC = p(150, GROUND - THIGH - SHIN + 2);
  const f = frontTorso(hipC);
  s.ground(80, 220);
  // legs
  s.line(f.lHip, p(f.lHip.x - 6, GROUND - 2), 'body', 13).line(f.rHip, p(f.rHip.x + 6, GROUND - 2), 'body', 13);
  drawFrontTorso(s, f);
  // resting arm (screen left)
  s.line(f.lSh, at(f.lSh, UPPER_ARM + FOREARM, -10));
  // working arm lifts out to the side
  const a = clamp(t, 0, 1.15) * 90;
  const len = UPPER_ARM + FOREARM;
  s.guide(arcGuide(f.rSh, len + 14, 12, 94));
  const hand = at(f.rSh, len, 8 + a);
  s.line(f.rSh, hand, 'move');
  s.phone(hand, 8 + a);
  return s.done();
};

const pendulum: Builder = ({ theta }) => {
  const s = new Sketch();
  s.ground(40, 290);
  // table to lean on, on the right
  const tableY = 168;
  s.tableSide(214, 292, tableY, 282);
  const hip = p(118, STAND_HIP_Y - 2);
  const b = sideTorso(hip, 112); // leaning well forward
  const ankleFar = p(104, GROUND - 4);
  const ankleNear = p(122, GROUND - 4);
  s.chain(standingLeg(hip, ankleFar), 'far').foot(ankleFar, 90, 'far');
  // supporting arm, hand flat on the table
  const handOnTable = p(236, tableY - 10);
  s.chain([b.shoulder, ik(b.shoulder, handOnTable, UPPER_ARM, FOREARM, 'down'), handOnTable], 'far');
  drawTorso(s, b, 'body', 112);
  s.chain(standingLeg(hip, ankleNear)).foot(ankleNear);
  // hanging arm drawing small circles
  const len = UPPER_ARM + FOREARM;
  const base = at(b.shoulder, len - 6, 0);
  const hand = p(base.x + 22 * Math.sin(rad(theta)), base.y + 8 * Math.cos(rad(theta)));
  s.guide(ellipseGuide(base, 22, 8));
  s.line(b.shoulder, hand, 'move');
  s.phone(hand, 0);
  return s.done();
};

const externalRotation: Builder = ({ t }) => {
  // seen from above, person facing down the screen
  const s = new Sketch();
  const c = p(150, 112);
  s.poly(ellipsePts(c, 66, 22), 'far'); // shoulders
  const lEl = p(c.x - 58, c.y + 10);
  const rEl = p(c.x + 58, c.y + 10);
  // resting arm: forearm across the belly
  s.line(lEl, at(lEl, 66, 40), 'far');
  // working arm: from across the belly (-40°) rotating outward
  const a = -40 + clamp(t, 0, 1.1) * 110;
  s.guide(arcGuide(rEl, 80, -42, 72));
  const hand = at(rEl, 66, a);
  s.line(rEl, hand, 'move');
  s.circle(rEl, 8, 'move');
  s.phone(hand, a);
  s.head(c, 0);
  s.text(150, 278, 'View from above');
  return s.done();
};

/** Seated, side view, facing right. Returns joints; chair drawn. */
function seated(s: Sketch, hipX = 96, opts: { chair?: boolean } = {}) {
  const ankleY = GROUND - 4;
  const hip = p(hipX, ankleY - SHIN);
  if (opts.chair !== false) s.chairSide(hipX - 26, hipX + 30, hip.y + 12, hip.y - 70);
  const b = sideTorso(hip, 176);
  return { b, hip, ankleY };
}

/** Seated legs: thigh forward, shin down. */
function seatedLeg(s: Sketch, hip: Pt, tone: Tone, dx = 0) {
  const knee = p(hip.x + THIGH + dx, hip.y);
  const ankle = p(knee.x, knee.y + SHIN);
  s.chain([hip, knee, ankle], tone).foot(ankle, 90, tone);
  return { knee, ankle };
}

function tableArmBase(s: Sketch) {
  s.ground(30, 290);
  const { b, hip } = seated(s, 84);
  seatedLeg(s, hip, 'far', 4);
  return { b, hip };
}

const wristFlexion: Builder = ({ t }) => {
  const s = new Sketch();
  const { b, hip } = tableArmBase(s);
  const tableY = 158;
  const edge = 218;
  s.tableSide(150, edge, tableY + 9, 160);
  drawTorso(s, b, 'body', 90);
  seatedLeg(s, hip, 'body');
  const wrist = p(edge - 4, tableY);
  const elbow = p(wrist.x - FOREARM - 18, tableY);
  s.chain([b.shoulder, elbow, wrist]);
  const a = 66 + clamp(t, 0, 1.15) * 66; // hand hanging a little → lifted toward the ceiling
  s.guide(arcGuide(wrist, 46, 60, 138));
  const tip = at(wrist, 32, a);
  s.line(wrist, tip, 'move', 13);
  s.phone(at(wrist, 18, a), a);
  return s.done();
};

const wristCircles: Builder = ({ theta }) => {
  const s = new Sketch();
  const { b, hip } = tableArmBase(s);
  const tableY = 170;
  s.tableSide(150, 250, tableY + 9, 240);
  drawTorso(s, b, 'body', 90);
  seatedLeg(s, hip, 'body');
  const elbow = p(196, tableY);
  const wrist = at(elbow, FOREARM + 8, 184);
  s.chain([b.shoulder, elbow, wrist]);
  const loop = add(wrist, p(0, -26));
  const tip = p(loop.x + 18 * Math.sin(rad(theta)), loop.y + 9 * Math.cos(rad(theta)));
  s.guide(ellipseGuide(loop, 18, 9));
  s.line(wrist, tip, 'move', 13);
  s.phone(lerpPt(wrist, tip, 0.6), 180 + 30 * Math.sin(rad(theta)));
  return s.done();
};

const forearmRotation: Builder = ({ t }) => {
  // seated, front view: the hand is seen end-on and turns from thumb-up to palm-down
  const s = new Sketch();
  const hipC = p(150, 168);
  const f = frontTorso(hipC);
  s.ground(70, 230);
  // chair seat behind the hips
  s.poly([p(104, hipC.y + 4), p(196, hipC.y + 4), p(196, hipC.y + 14), p(104, hipC.y + 14)], 'prop');
  s.line(p(110, hipC.y + 14), p(110, GROUND + 4), 'prop', 6).line(p(190, hipC.y + 14), p(190, GROUND + 4), 'prop', 6);
  // legs: thighs come toward us (short), shins down
  for (const [hipPt, dx] of [[f.lHip, -10], [f.rHip, 10]] as const) {
    const knee = p(hipPt.x + dx, hipPt.y + 22);
    s.chain([hipPt, knee, p(knee.x, GROUND - 2)], 'body', 13);
  }
  drawFrontTorso(s, f);
  // resting arm on the thigh
  s.chain([f.lSh, p(f.lSh.x - 10, f.lSh.y + 50), p(f.lHip.x + 2, f.lHip.y + 14)]);
  // working arm: elbow tucked at the side, forearm pointing at us
  const elbow = p(f.rSh.x + 8, f.rSh.y + 50);
  s.line(f.rSh, elbow);
  const handC = p(elbow.x + 26, elbow.y + 16);
  s.line(elbow, handC, 'body', 14);
  const rot = clamp(t, 0, 1.1) * 90; // 0 = thumb up, 90 = palm down (thumb turns toward the body)
  s.guide(arcGuide(handC, 38, 180, 270));
  const half = vec(22, 180 + rot); // along the hand, toward the thumb side
  s.poly(bar(p(handC.x - half.x, handC.y - half.y), 180 + rot, 44, 20), 'move');
  s.circle(at(handC, 26, 180 + rot), 7, 'move'); // thumb
  return s.done();
};

const seatedMarching: Builder = ({ t }) => {
  const s = new Sketch();
  s.ground(30, 280);
  const { b, hip } = seated(s, 104);
  seatedLeg(s, hip, 'far', 4);
  drawTorso(s, b, 'body', 90);
  const lift = clamp(t, 0, 1.2) * 34;
  const knee = at(hip, THIGH, 90 + lift);
  const ankle = at(knee, SHIN, 0);
  s.guide(arcGuide(hip, THIGH + 14, 88, 128));
  s.chain([hip, knee, ankle], 'move').foot(ankle, 90, 'move');
  s.phone(at(hip, THIGH - 14, 90 + lift), 90 + lift);
  // hand holding the phone on the thigh
  s.line(b.shoulder, at(hip, THIGH - 22, 90 + lift), 'body');
  return s.done();
};

const kneeExtension: Builder = ({ t }) => {
  const s = new Sketch();
  s.ground(30, 290);
  const { b, hip } = seated(s, 96);
  seatedLeg(s, hip, 'far', 4);
  drawTorso(s, b, 'body', 90);
  s.line(b.shoulder, p(hip.x + 26, hip.y - 4), 'body'); // hand resting on the thigh
  const knee = p(hip.x + THIGH, hip.y);
  s.line(hip, knee);
  const a = clamp(t, 0, 1.15) * 80;
  s.guide(arcGuide(knee, SHIN + 26, 4, 86));
  const ankle = at(knee, SHIN, a);
  s.line(knee, ankle, 'move').foot(ankle, a + 90, 'move');
  s.phone(at(knee, SHIN - 18, a), a);
  return s.done();
};

const sitToStand: Builder = ({ t }) => {
  const s = new Sketch();
  s.ground(30, 280);
  const k = clamp(t, 0, 1);
  const ease = k * k * (3 - 2 * k);
  const seatHip = p(102, GROUND - 4 - SHIN);
  s.chairSide(seatHip.x - 26, seatHip.x + 30, seatHip.y + 12, seatHip.y - 70);
  const ankle = p(152, GROUND - 4);
  const hip = p(lerp(seatHip.x, 146, ease), lerp(seatHip.y, STAND_HIP_Y, ease));
  const lean = 180 - 42 * Math.sin(Math.PI * Math.min(1, k * 1.05));
  const b = sideTorso(hip, lean);
  const ankleFar = p(ankle.x - 8, ankle.y);
  s.chain(standingLeg(hip, ankleFar), 'far').foot(ankleFar, 90, 'far');
  drawTorso(s, b, 'body', lean - 90);
  const knee = ik(hip, ankle, THIGH, SHIN, 1);
  s.chain([hip, knee, ankle], 'move').foot(ankle, 90, 'move');
  const onThigh = lerpPt(hip, knee, 0.55);
  s.chain([b.shoulder, ik(b.shoulder, onThigh, UPPER_ARM, FOREARM, -1), onThigh]);
  s.phone(lerpPt(hip, knee, 0.5), Math.atan2(knee.x - hip.x, knee.y - hip.y) * (180 / Math.PI));
  return s.done();
};

const miniSquat: Builder = ({ t }) => {
  const s = new Sketch();
  s.ground(30, 290);
  const counterY = 150;
  s.tableSide(196, 292, counterY, 286);
  const k = clamp(t, 0, 1.2);
  const ankle = p(122, GROUND - 4);
  const hip = p(118 - 12 * k, STAND_HIP_Y + 26 * k);
  const lean = 180 - 14 * k;
  const b = sideTorso(hip, lean);
  const ankleFar = p(ankle.x - 10, ankle.y);
  s.chain(standingLeg(hip, ankleFar), 'far').foot(ankleFar, 90, 'far');
  const hand = p(206, counterY - 8);
  s.chain([b.shoulder, ik(b.shoulder, hand, UPPER_ARM, FOREARM, 'down'), hand], 'far');
  drawTorso(s, b, 'body', 90);
  const knee = ik(hip, ankle, THIGH, SHIN, 1);
  s.guide(arcGuide(hip, 26, 150, 210));
  s.chain([hip, knee, ankle], 'move').foot(ankle, 90, 'move');
  s.chain([b.shoulder, ik(b.shoulder, hand, UPPER_ARM, FOREARM, 'down'), hand]);
  s.phone(lerpPt(hip, knee, 0.35), Math.atan2(knee.x - hip.x, knee.y - hip.y) * (180 / Math.PI));
  return s.done();
};

const hipAbduction: Builder = ({ t }) => {
  // seen from behind, holding a counter in front of them
  const s = new Sketch();
  s.ground(50, 250);
  const hipC = p(150, GROUND - THIGH - SHIN + 2);
  const f = frontTorso(hipC);
  // counter (beyond the person)
  s.poly([p(70, 140), p(230, 140), p(230, 154), p(70, 154)], 'prop');
  s.line(p(80, 154), p(80, GROUND + 4), 'prop', 7).line(p(220, 154), p(220, GROUND + 4), 'prop', 7);
  s.line(f.lHip, p(f.lHip.x - 4, GROUND - 2), 'body', 13); // standing leg
  drawFrontTorso(s, f);
  // both hands on the counter
  s.chain([f.lSh, p(f.lSh.x - 14, 120), p(f.lSh.x - 8, 142)]).chain([f.rSh, p(f.rSh.x + 14, 120), p(f.rSh.x + 8, 142)]);
  const a = clamp(t, 0, 1.2) * 34;
  const len = THIGH + SHIN;
  s.guide(arcGuide(f.rHip, len + 12, 2, 40));
  const foot = at(f.rHip, len, 2 + a);
  s.line(f.rHip, foot, 'move', 13);
  s.phone(at(f.rHip, 22, 2 + a), 2 + a);
  s.text(150, 22, 'View from behind');
  return s.done();
};

/** Lying on the back on a mat, head on the left. */
function lying(s: Sketch, matY = 244) {
  s.mat(14, 292, matY, 12);
  const shoulder = p(70, matY - 10);
  const head = p(42, matY - 18);
  return { matY, shoulder, head, hip: p(shoulder.x + TORSO - 8, matY - 10) };
}

const gluteBridge: Builder = ({ t }) => {
  const s = new Sketch();
  const { matY, shoulder, head } = lying(s);
  const lift = clamp(t, 0, 1.2) * 40;
  const hip = p(shoulder.x + TORSO - 14, matY - 10 - lift);
  const ankle = p(222, matY - 12);
  const ankleFar = p(ankle.x - 8, ankle.y);
  s.chain([hip, ik(hip, ankleFar, THIGH, SHIN, 'up'), ankleFar], 'far').foot(ankleFar, 90, 'far');
  s.line(shoulder, p(shoulder.x + UPPER_ARM + FOREARM - 10, matY - 8), 'far'); // arm along the mat
  s.circle(head, HEAD_R);
  s.guide(arcGuide(p(hip.x, matY - 10), 54, 166, 194));
  const knee = ik(hip, ankle, THIGH, SHIN, 'up');
  s.line(shoulder, hip, 'move', TORSO_SIDE);
  s.chain([hip, knee, ankle], 'move').foot(ankle, 90, 'move');
  s.phone(lerpPt(hip, knee, 0.75), Math.atan2(knee.x - hip.x, knee.y - hip.y) * (180 / Math.PI));
  return s.done();
};

const heelSlides: Builder = ({ t }) => {
  const s = new Sketch();
  const { matY, shoulder, head, hip } = lying(s);
  const k = clamp(t, 0, 1.15);
  const straight = p(hip.x + THIGH + SHIN - 2, matY - 10);
  s.chain([hip, straight], 'far').foot(straight, 180, 'far');
  s.line(shoulder, p(shoulder.x + UPPER_ARM + FOREARM - 10, matY - 8), 'far');
  s.line(shoulder, hip, 'body', TORSO_SIDE).circle(head, HEAD_R);
  const ankle = p(straight.x - k * 74, matY - 10);
  const knee = ik(hip, ankle, THIGH, SHIN, 'up');
  s.guide({ kind: 'path', d: `M ${r1(straight.x + 6)} ${r1(matY - 30)} L ${r1(straight.x - 84)} ${r1(matY - 30)}`, w: 3, tone: 'guide' });
  const footDeg = 180 - 90 * Math.min(1, k * 1.4);
  s.chain([hip, knee, ankle], 'move').foot(ankle, footDeg, 'move');
  s.phone(lerpPt(knee, ankle, 0.6), Math.atan2(ankle.x - knee.x, ankle.y - knee.y) * (180 / Math.PI));
  return s.done();
};

const straightLegRaise: Builder = ({ t }) => {
  const s = new Sketch();
  const { matY, shoulder, head, hip } = lying(s);
  const ankleBent = p(hip.x + 72, matY - 12);
  s.chain([hip, ik(hip, ankleBent, THIGH, SHIN, 'up'), ankleBent], 'far').foot(ankleBent, 90, 'far');
  s.line(shoulder, p(shoulder.x + UPPER_ARM + FOREARM - 10, matY - 8), 'far');
  s.line(shoulder, hip, 'body', TORSO_SIDE).circle(head, HEAD_R);
  const a = 90 + clamp(t, 0, 1.2) * 38;
  const len = THIGH + SHIN;
  s.guide(arcGuide(hip, len + 14, 92, 132));
  const ankle = at(hip, len, a);
  s.line(hip, ankle, 'move').foot(ankle, a + 90, 'move');
  s.phone(at(hip, 34, a), a);
  return s.done();
};

const anklePumps: Builder = ({ t }) => {
  // long-sitting on a bed or the floor, legs straight out
  const s = new Sketch();
  const matY = 246;
  s.mat(14, 292, matY, 12);
  const hip = p(70, matY - 12);
  const b = sideTorso(hip, 170);
  const ankle = p(hip.x + THIGH + SHIN + 34, matY - 14);
  s.line(hip, p(ankle.x - 8, ankle.y + 2), 'far');
  drawTorso(s, b, 'body', 90);
  s.line(hip, ankle);
  s.line(b.shoulder, p(hip.x + 54, hip.y - 4)); // hand resting on the thigh
  const f = 156 + clamp(t, 0, 1.2) * 48; // toes pointed a little → pulled toward the nose
  s.guide(arcGuide(ankle, 52, 150, 210));
  const toe = at(ankle, FOOT + 20, f);
  s.line(ankle, toe, 'move', 13);
  s.phone(at(ankle, 24, f), f);
  return s.done();
};

const trunkRotation: Builder = ({ t }) => {
  // seated, seen from above
  const s = new Sketch();
  const c = p(150, 124);
  // chair seat and thighs stay put
  s.poly([p(104, 112), p(196, 112), p(196, 196), p(104, 196)], 'prop');
  s.line(p(130, 140), p(126, 236), 'far', 16).line(p(170, 140), p(174, 236), 'far', 16);
  const rot = clamp(t, 0, 1.15) * 70;
  s.guide(arcGuide(c, 92, -4, 72));
  s.poly(ellipsePts(c, 66, 22, rot), 'body');
  s.line(add(c, rotate(p(-60, 0), rot)), add(c, rotate(p(60, 0), rot)), 'move', 10);
  // phone held flat on the chest (arms crossed over it)
  s.phone(add(c, rotate(p(0, 30), rot)), rot + 90);
  s.circle(c, HEAD_R + 1, 'move').circle(add(c, rotate(p(0, HEAD_R + 2), rot)), 5, 'move');
  s.text(150, 278, 'View from above');
  return s.done();
};

function rotate(q: Pt, deg: number): Pt {
  const a = rad(deg);
  return p(q.x * Math.cos(a) - q.y * Math.sin(a), q.x * Math.sin(a) + q.y * Math.cos(a));
}

const sideBend: Builder = ({ t }) => {
  const s = new Sketch();
  s.ground(80, 220);
  const hipC = p(146, GROUND - THIGH - SHIN + 2);
  const lean = 180 - clamp(t, 0, 1.2) * 24;
  const f = frontTorso(hipC, lean);
  s.line(f.lHip, p(f.lHip.x - 8, GROUND - 2), 'body', 13).line(f.rHip, p(f.rHip.x + 8, GROUND - 2), 'body', 13);
  s.guide(arcGuide(hipC, TORSO + 30, 152, 182));
  drawFrontTorso(s, f, 'move');
  // hand sliding down the outside of the leg
  const slide = at(f.rSh, UPPER_ARM + FOREARM, 6);
  s.line(f.rSh, slide, 'move');
  // other hand holds the phone on the chest
  const chest = lerpPt(lerpPt(f.lSh, f.rSh, 0.5), hipC, 0.3);
  s.chain([f.lSh, ik(f.lSh, chest, UPPER_ARM, FOREARM, 'down'), chest], 'body');
  s.phone(chest, lean);
  return s.done();
};

export const FIGURES: Record<string, Builder> = {
  'shoulder-flexion': shoulderFlexion,
  'shoulder-abduction': shoulderAbduction,
  'shoulder-circles': shoulderCircles,
  pendulum,
  'shoulder-external-rotation': externalRotation,
  'elbow-flexion': elbowFlexion,
  'wrist-flexion-extension': wristFlexion,
  'forearm-rotation': forearmRotation,
  'wrist-circles': wristCircles,
  'seated-marching': seatedMarching,
  'standing-hip-abduction': hipAbduction,
  'glute-bridge': gluteBridge,
  'seated-knee-extension': kneeExtension,
  'heel-slides': heelSlides,
  'straight-leg-raise': straightLegRaise,
  'sit-to-stand': sitToStand,
  'mini-squat': miniSquat,
  'ankle-pumps': anklePumps,
  'seated-trunk-rotation': trunkRotation,
  'standing-side-bend': sideBend,
};

export function figureFor(slug: string, motion: Motion): Figure | null {
  const build = FIGURES[slug];
  return build ? build(motion) : null;
}
