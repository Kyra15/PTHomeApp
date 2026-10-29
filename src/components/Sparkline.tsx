import React from 'react';
import Svg, { Polyline } from 'react-native-svg';

interface Props {
  values: number[];
  width: number;
  height: number;
  color: string;
  /** Fixed top of the scale; values above are clipped. Defaults to the max of the data. */
  max?: number;
  strokeWidth?: number;
}

/** Tiny live line chart for the accelerometer / gyroscope strip on the live exercise screen (mockup p4). */
export function Sparkline({ values, width, height, color, max, strokeWidth = 3 }: Props) {
  if (values.length < 2) return <Svg width={width} height={height} />;
  const top = max ?? Math.max(...values, 0.0001);
  const step = width / (values.length - 1);
  const pad = strokeWidth;
  const pts = values
    .map((v, i) => {
      const y = height - pad - (Math.min(v, top) / top) * (height - pad * 2);
      return `${(i * step).toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <Svg width={width} height={height}>
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
