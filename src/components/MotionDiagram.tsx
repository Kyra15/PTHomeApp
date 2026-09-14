import React from 'react';
import Svg, { Circle, Line, Rect, G } from 'react-native-svg';
import { DiagramKind } from '../types/exercise';
import { colors } from '../theme/theme';

interface Props {
  kind: DiagramKind;
  /**
   * For raise-front / raise-side: 0–90, degrees the limb has tilted from rest.
   * For circle-shoulder / circle-wrist: 0–360, position of the limb around the loop.
   */
  angleDeg: number;
  accentColor: string;
  size?: number;
}

const VB = 300;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** A point around a circle where 0° is straight down and it sweeps clockwise. */
function pointOnLoop(cx: number, cy: number, r: number, deg: number) {
  const rad = toRad(deg);
  return { x: cx + r * Math.sin(rad), y: cy + r * Math.cos(rad) };
}

function HeadAndLegs({ headX, headY, hipX, hipY, footY }: { headX: number; headY: number; hipX: number; hipY: number; footY: number }) {
  return (
    <G>
      <Circle cx={headX} cy={headY} r={24} fill={colors.textSecondary} />
      <Line x1={hipX - 16} y1={hipY} x2={hipX - 22} y2={footY} stroke={colors.textSecondary} strokeWidth={10} strokeLinecap="round" />
      <Line x1={hipX + 16} y1={hipY} x2={hipX + 22} y2={footY} stroke={colors.textSecondary} strokeWidth={10} strokeLinecap="round" />
    </G>
  );
}

function FrontRaiseFigure({ angleDeg, accentColor }: { angleDeg: number; accentColor: string }) {
  const shoulder = { x: 108, y: 96 };
  const armLen = 82;
  const rad = toRad(angleDeg);
  const dx = Math.sin(rad) * armLen; // forward
  const dy = Math.cos(rad) * armLen; // down, shrinking as arm rises
  const hand = { x: shoulder.x + dx, y: shoulder.y + dy };

  return (
    <G>
      <HeadAndLegs headX={104} headY={56} hipX={104} hipY={195} footY={268} />
      {/* nose, indicating the figure faces right / "forward" */}
      <Circle cx={126} cy={58} r={6} fill={colors.textSecondary} />
      <Line x1={104} y1={82} x2={104} y2={195} stroke={colors.textSecondary} strokeWidth={16} strokeLinecap="round" />
      <Circle cx={shoulder.x} cy={shoulder.y} r={7} fill={accentColor} />
      <Line x1={shoulder.x} y1={shoulder.y} x2={hand.x} y2={hand.y} stroke={accentColor} strokeWidth={12} strokeLinecap="round" />
      <Circle cx={hand.x} cy={hand.y} r={11} fill={accentColor} />
    </G>
  );
}

function SideRaiseFigure({ angleDeg, accentColor }: { angleDeg: number; accentColor: string }) {
  const leftShoulder = { x: 122, y: 96 };
  const rightShoulder = { x: 178, y: 96 };
  const armLen = 82;
  const rad = toRad(angleDeg);
  const dx = Math.sin(rad) * armLen; // outward, to the right
  const dy = Math.cos(rad) * armLen; // down, shrinking as arm rises
  const hand = { x: rightShoulder.x + dx, y: rightShoulder.y + dy };

  return (
    <G>
      <HeadAndLegs headX={150} headY={56} hipX={150} hipY={195} footY={268} />
      <Line x1={130} y1={84} x2={130} y2={195} stroke={colors.textSecondary} strokeWidth={40} strokeLinecap="round" opacity={0} />
      <Rect x={122} y={82} width={56} height={112} rx={26} fill={colors.textSecondary} />
      {/* static, non-exercising arm */}
      <Line x1={leftShoulder.x} y1={leftShoulder.y} x2={leftShoulder.x - 14} y2={leftShoulder.y + 78} stroke={colors.textSecondary} strokeWidth={12} strokeLinecap="round" />
      <Circle cx={rightShoulder.x} cy={rightShoulder.y} r={7} fill={accentColor} />
      <Line x1={rightShoulder.x} y1={rightShoulder.y} x2={hand.x} y2={hand.y} stroke={accentColor} strokeWidth={12} strokeLinecap="round" />
      <Circle cx={hand.x} cy={hand.y} r={11} fill={accentColor} />
    </G>
  );
}

function ShoulderCircleFigure({ angleDeg, accentColor }: { angleDeg: number; accentColor: string }) {
  const shoulder = { x: 178, y: 100 };
  const radius = 80;
  const dot = pointOnLoop(shoulder.x, shoulder.y, radius, angleDeg);

  return (
    <G>
      <HeadAndLegs headX={140} headY={58} hipX={140} hipY={195} footY={268} />
      <Rect x={116} y={84} width={48} height={110} rx={24} fill={colors.textSecondary} />
      <Line x1={116} y1={96} x2={104} y2={172} stroke={colors.textSecondary} strokeWidth={12} strokeLinecap="round" />
      <Circle cx={shoulder.x} cy={shoulder.y} r={radius} stroke={colors.border} strokeWidth={3} strokeDasharray="10,10" fill="none" />
      <Circle cx={shoulder.x} cy={shoulder.y} r={7} fill={accentColor} />
      <Line x1={shoulder.x} y1={shoulder.y} x2={dot.x} y2={dot.y} stroke={accentColor} strokeWidth={12} strokeLinecap="round" />
      <Circle cx={dot.x} cy={dot.y} r={12} fill={accentColor} />
    </G>
  );
}

function WristCircleFigure({ angleDeg, accentColor }: { angleDeg: number; accentColor: string }) {
  const elbow = { x: 150, y: 235 };
  const wrist = { x: 150, y: 140 };
  const radius = 46;
  const dot = pointOnLoop(wrist.x, wrist.y, radius, angleDeg);

  return (
    <G>
      {/* forearm resting toward a surface */}
      <Line x1={90} y1={260} x2={210} y2={260} stroke={colors.border} strokeWidth={6} strokeLinecap="round" />
      <Line x1={elbow.x} y1={elbow.y} x2={wrist.x} y2={wrist.y} stroke={colors.textSecondary} strokeWidth={16} strokeLinecap="round" />
      <Circle cx={wrist.x} cy={wrist.y} r={radius} stroke={colors.border} strokeWidth={3} strokeDasharray="8,8" fill="none" />
      <Circle cx={wrist.x} cy={wrist.y} r={7} fill={colors.textSecondary} />
      {/* the phone, rotating around the wrist */}
      <G
        origin={`${dot.x}, ${dot.y}`}
        rotation={angleDeg}
      >
        <Rect x={dot.x - 14} y={dot.y - 22} width={28} height={44} rx={6} fill={accentColor} />
      </G>
    </G>
  );
}

export function MotionDiagram({ kind, angleDeg, accentColor, size = 260 }: Props) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
      {kind === 'raise-front' && <FrontRaiseFigure angleDeg={angleDeg} accentColor={accentColor} />}
      {kind === 'raise-side' && <SideRaiseFigure angleDeg={angleDeg} accentColor={accentColor} />}
      {kind === 'circle-shoulder' && <ShoulderCircleFigure angleDeg={angleDeg} accentColor={accentColor} />}
      {kind === 'circle-wrist' && <WristCircleFigure angleDeg={angleDeg} accentColor={accentColor} />}
    </Svg>
  );
}
