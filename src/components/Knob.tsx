"use client";

import { useRef, useCallback } from "react";

interface Props {
  value: number;
  min: number;
  max: number;
  label: string;
  unit?: string;
  decimals?: number;
  color?: string;
  onChange: (v: number) => void;
}

const SIZE = 52;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 20;
const START_DEG = 225;
const RANGE_DEG = 270;

function polarToXY(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const s = polarToXY(cx, cy, r, from);
  const e = polarToXY(cx, cy, r, to);
  const sweep = ((to - from + 360) % 360) > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${sweep} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

export default function Knob({
  value, min, max, label, unit = "", decimals = 1, color = "#00d4ff", onChange,
}: Props) {
  const dragRef = useRef<{ startY: number; startNorm: number } | null>(null);

  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const currentDeg = START_DEG + normalized * RANGE_DEG;
  const endDeg = START_DEG + RANGE_DEG; // = 495

  const trackPath = arcPath(CX, CY, R, START_DEG, endDeg);
  const valuePath = normalized > 0.001
    ? arcPath(CX, CY, R, START_DEG, currentDeg)
    : "";

  const indicator = polarToXY(CX, CY, R - 5, currentDeg);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragRef.current = { startY: e.clientY, startNorm: normalized };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [normalized]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dy = dragRef.current.startY - e.clientY;
    const newNorm = Math.max(0, Math.min(1, dragRef.current.startNorm + dy / 180));
    onChange(min + newNorm * (max - min));
  }, [min, max, onChange]);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const displayVal = value.toFixed(decimals);

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <svg
        width={SIZE}
        height={SIZE}
        className="knob-drag"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ cursor: "ns-resize" }}
      >
        {/* Outer ring */}
        <circle cx={CX} cy={CY} r={R + 3} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {/* Inner fill */}
        <circle cx={CX} cy={CY} r={R - 6} fill="#0f0f1e" />

        {/* Track */}
        <path d={trackPath} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" strokeLinecap="round" />

        {/* Value arc */}
        {valuePath && (
          <path
            d={valuePath}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 3px ${color})` }}
          />
        )}

        {/* Indicator dot */}
        <circle
          cx={indicator.x}
          cy={indicator.y}
          r={2.5}
          fill={color}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>

      <span
        className="text-xs font-mono tabular-nums"
        style={{ color, fontSize: "10px", letterSpacing: "0.05em" }}
      >
        {displayVal}{unit}
      </span>
      <span className="text-center leading-tight" style={{ color: "#64748b", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </span>
    </div>
  );
}
