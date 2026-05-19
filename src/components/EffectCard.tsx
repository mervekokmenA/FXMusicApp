"use client";

import Knob from "./Knob";
import { EffectsState, FilterType } from "@/hooks/useAudioEngine";

interface Props {
  effectKey: keyof EffectsState;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  effect: any;
  color: string;
  icon: string;
  title: string;
  onToggle: () => void;
  onParam: (patch: object) => void;
}

export default function EffectCard({ effectKey, effect, color, icon, title, onToggle, onParam }: Props) {
  const active = effect.enabled;

  return (
    <div
      className={`card p-4 flex flex-col gap-3 transition-all duration-200 ${active ? "card-active" : ""}`}
      style={active ? { borderColor: color + "80", boxShadow: `0 0 18px ${color}18, inset 0 0 12px ${color}06` } : {}}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "16px" }}>{icon}</span>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: active ? color : "#94a3b8" }}>
            {title}
          </span>
        </div>

        {/* Toggle */}
        <button
          onClick={onToggle}
          className="relative w-10 h-5 rounded-full transition-all duration-200 flex-shrink-0"
          style={{
            background: active ? color : "rgba(255,255,255,0.08)",
            boxShadow: active ? `0 0 8px ${color}60` : "none",
          }}
        >
          <span
            className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200"
            style={{ left: active ? "calc(100% - 18px)" : "2px", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}
          />
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-end justify-center gap-4 pt-1">
        <Controls effectKey={effectKey} effect={effect} color={color} onParam={onParam} />
      </div>
    </div>
  );
}

function Controls({ effectKey, effect, color, onParam }: {
  effectKey: keyof EffectsState;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  effect: any;
  color: string;
  onParam: (p: object) => void;
}) {
  switch (effectKey) {
    case "filter":
      return (
        <>
          <div className="flex flex-col items-center gap-1">
            <select
              value={effect.type}
              onChange={e => onParam({ type: e.target.value as FilterType })}
              className="text-xs rounded px-1.5 py-0.5 outline-none border"
              style={{ background: "#0f0f1e", color: "#94a3b8", borderColor: "rgba(255,255,255,0.1)", fontSize: "9px" }}
            >
              <option value="lowpass">Low Pass</option>
              <option value="highpass">High Pass</option>
              <option value="bandpass">Band Pass</option>
              <option value="notch">Notch</option>
            </select>
            <span style={{ color: "#64748b", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Type</span>
          </div>
          <Knob value={effect.frequency} min={80} max={18000} label="Freq" unit="Hz" decimals={0} color={color} onChange={v => onParam({ frequency: v })} />
          <Knob value={effect.resonance} min={0.1} max={20} label="Resonance" decimals={1} color={color} onChange={v => onParam({ resonance: v })} />
        </>
      );

    case "distortion":
      return (
        <>
          <Knob value={effect.drive} min={1} max={100} label="Drive" decimals={0} color={color} onChange={v => onParam({ drive: v })} />
          <Knob value={effect.tone} min={200} max={18000} label="Tone" unit="Hz" decimals={0} color={color} onChange={v => onParam({ tone: v })} />
        </>
      );

    case "delay":
      return (
        <>
          <Knob value={effect.time} min={0.05} max={1.0} label="Time" unit="s" decimals={2} color={color} onChange={v => onParam({ time: v })} />
          <Knob value={effect.feedback} min={0} max={0.95} label="Feedback" decimals={2} color={color} onChange={v => onParam({ feedback: v })} />
          <Knob value={effect.mix} min={0} max={1} label="Mix" decimals={2} color={color} onChange={v => onParam({ mix: v })} />
        </>
      );

    case "reverb":
      return (
        <>
          <Knob value={effect.decay} min={0.1} max={10} label="Decay" unit="s" decimals={1} color={color} onChange={v => onParam({ decay: v })} />
          <Knob value={effect.mix} min={0} max={1} label="Mix" decimals={2} color={color} onChange={v => onParam({ mix: v })} />
        </>
      );

    case "tremolo":
      return (
        <>
          <Knob value={effect.rate} min={0.1} max={20} label="Rate" unit="Hz" decimals={1} color={color} onChange={v => onParam({ rate: v })} />
          <Knob value={effect.depth} min={0} max={1} label="Depth" decimals={2} color={color} onChange={v => onParam({ depth: v })} />
        </>
      );

    case "chorus":
      return (
        <>
          <Knob value={effect.rate} min={0.1} max={5} label="Rate" unit="Hz" decimals={1} color={color} onChange={v => onParam({ rate: v })} />
          <Knob value={effect.depth} min={1} max={20} label="Depth" unit="ms" decimals={1} color={color} onChange={v => onParam({ depth: v })} />
          <Knob value={effect.mix} min={0} max={1} label="Mix" decimals={2} color={color} onChange={v => onParam({ mix: v })} />
        </>
      );

    case "flanger":
      return (
        <>
          <Knob value={effect.rate} min={0.05} max={5} label="Rate" unit="Hz" decimals={2} color={color} onChange={v => onParam({ rate: v })} />
          <Knob value={effect.depth} min={0.5} max={10} label="Depth" unit="ms" decimals={1} color={color} onChange={v => onParam({ depth: v })} />
          <Knob value={effect.feedback} min={0} max={0.95} label="Feedback" decimals={2} color={color} onChange={v => onParam({ feedback: v })} />
        </>
      );

    case "compressor":
      return (
        <>
          <Knob value={effect.threshold} min={-60} max={0} label="Threshold" unit="dB" decimals={0} color={color} onChange={v => onParam({ threshold: v })} />
          <Knob value={effect.ratio} min={1} max={20} label="Ratio" unit=":1" decimals={1} color={color} onChange={v => onParam({ ratio: v })} />
        </>
      );

    case "bitCrusher":
      return (
        <>
          <Knob value={effect.bits} min={1} max={16} label="Bits" decimals={0} color={color} onChange={v => onParam({ bits: Math.round(v) })} />
          <Knob value={effect.mix} min={0} max={1} label="Mix" decimals={2} color={color} onChange={v => onParam({ mix: v })} />
        </>
      );

    default:
      return null;
  }
}
