/**
 * Design tokens for Home PT Coach.
 *
 * Everything here is deliberately oversized and high-contrast. The target
 * user is someone who may have low vision, limited fine motor control, or
 * simply doesn't want to squint at a phone while mid-exercise. Rules of
 * thumb used throughout the app:
 *   - No interactive element is shorter than 72px tall.
 *   - Body text is never smaller than 20px; anything a user must read
 *     while moving is 28px+.
 *   - Color is never the *only* signal — every color cue is paired with
 *     an icon/shape change, a haptic pulse, and/or spoken feedback.
 */

export const colors = {
  // Calm, neutral "paper" background used on list/instruction screens.
  background: '#F6F4EF',
  surface: '#FFFFFF',
  surfaceAlt: '#ECE8DF',

  // Deep warm ink instead of pure black — softer on aging eyes, still AAA contrast.
  textPrimary: '#1E2A32',
  textSecondary: '#4B5B63',
  textOnDark: '#FFFFFF',

  border: '#D8D2C4',

  // Primary brand accent — a muted, medical-adjacent but warm teal.
  primary: '#0E6E66',
  primaryDark: '#0A4F49',

  // Full-screen motion-feedback palette (the "signature" element of the app).
  motionRest: '#2C5F8A', // calm blue — "you're at the ready/start position"
  motionMoving: '#B4790F', // warm amber — "keep going, you're moving toward the target"
  motionSuccess: '#227A3D', // vivid green — "target reached / rep counted"
  motionFlash: '#3FB767', // brighter flash green for the reward pulse
  motionAlert: '#9C4221', // gentle terracotta — "slow down" / "hold still" cues

  celebrate: '#B7791F',

  danger: '#9B2C2C',
  disabled: '#B8B2A4',
} as const;

export const type = {
  display: { fontSize: 44, fontWeight: '800' as const, lineHeight: 50 },
  h1: { fontSize: 34, fontWeight: '800' as const, lineHeight: 40 },
  h2: { fontSize: 26, fontWeight: '700' as const, lineHeight: 32 },
  body: { fontSize: 22, fontWeight: '500' as const, lineHeight: 30 },
  bodyLarge: { fontSize: 26, fontWeight: '600' as const, lineHeight: 34 },
  button: { fontSize: 26, fontWeight: '800' as const, lineHeight: 30 },
  caption: { fontSize: 18, fontWeight: '500' as const, lineHeight: 24 },
  giant: { fontSize: 88, fontWeight: '800' as const, lineHeight: 92 },
};

export const spacing = {
  xs: 8,
  sm: 12,
  md: 20,
  lg: 28,
  xl: 40,
  xxl: 56,
};

export const radii = {
  md: 18,
  lg: 26,
  pill: 999,
};

export const minTouchTarget = 72;
