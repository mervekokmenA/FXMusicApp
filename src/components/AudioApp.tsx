"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import Visualizer from "./Visualizer";
import EffectCard from "./EffectCard";
import { useAudioEngine, EffectsState } from "@/hooks/useAudioEngine";

// ── effect metadata ───────────────────────────────────────────────────────────

const EFFECT_META: {
  key: keyof EffectsState;
  icon: string;
  title: string;
  color: string;
}[] = [
  { key: "filter",     icon: "🎚️", title: "Filter",      color: "#00d4ff" },
  { key: "distortion", icon: "🔥", title: "Distortion",  color: "#ef4444" },
  { key: "delay",      icon: "🔁", title: "Delay",       color: "#f59e0b" },
  { key: "reverb",     icon: "🌌", title: "Reverb",      color: "#6366f1" },
  { key: "tremolo",    icon: "〰️", title: "Tremolo",     color: "#10b981" },
  { key: "chorus",     icon: "✨", title: "Chorus",      color: "#ec4899" },
  { key: "flanger",    icon: "🌀", title: "Flanger",     color: "#a855f7" },
  { key: "compressor", icon: "📊", title: "Compressor",  color: "#64748b" },
  { key: "bitCrusher", icon: "💾", title: "Bit Crusher", color: "#f97316" },
];

// ── level meter ───────────────────────────────────────────────────────────────

function LevelMeter({ getAnalysers, running }: {
  getAnalysers: () => { in: AnalyserNode; out: AnalyserNode } | null;
  running: boolean;
}) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const a = getAnalysers();
      if (!a || !running) { setLevel(0); return; }
      const buf = new Uint8Array(a.out.frequencyBinCount);
      a.out.getByteFrequencyData(buf);
      const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length) / 128;
      setLevel(Math.min(1, rms * 2.5));
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [getAnalysers, running]);

  const bars = 20;
  return (
    <div className="flex gap-0.5 items-end h-4">
      {Array.from({ length: bars }, (_, i) => {
        const thresh = i / bars;
        const lit = level > thresh;
        const color = i < bars * 0.6 ? "#22c55e" : i < bars * 0.85 ? "#f59e0b" : "#ef4444";
        return (
          <div
            key={i}
            className="w-1.5 rounded-sm transition-all duration-75"
            style={{
              height: `${50 + (i / bars) * 50}%`,
              background: lit ? color : "rgba(255,255,255,0.07)",
            }}
          />
        );
      })}
    </div>
  );
}

// ── main app ─────────────────────────────────────────────────────────────────

export default function AudioApp() {
  const { state, start, stop, toggleMute, setMasterVolume, updateEffect, getAnalysers } =
    useAudioEngine();

  const handleToggle = useCallback(
    (key: keyof EffectsState) => {
      updateEffect(key, { enabled: !state.effects[key].enabled } as never);
    },
    [state.effects, updateEffect],
  );

  const activeCount = Object.values(state.effects).filter(e => e.enabled).length;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(135deg,#a855f7,#00d4ff)", opacity: 0.9 }} />
            <div className="absolute inset-1 rounded-full" style={{ background: "var(--bg)" }} />
            <div className="absolute inset-2 rounded-full" style={{ background: "linear-gradient(135deg,#a855f7,#00d4ff)" }} />
          </div>
          <div>
            <h1 className="font-bold tracking-widest uppercase text-sm" style={{ letterSpacing: "0.25em", color: "#e2e8f0" }}>
              FX Machine
            </h1>
            <p className="text-xs" style={{ color: "#64748b" }}>Real-time Audio Effects</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Level meter */}
          {state.running && (
            <LevelMeter getAnalysers={getAnalysers} running={state.running} />
          )}

          {/* Active effects badge */}
          {activeCount > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-mono"
              style={{ background: "rgba(0,212,255,0.12)", color: "#00d4ff", border: "1px solid rgba(0,212,255,0.3)" }}
            >
              {activeCount} FX
            </span>
          )}

          {/* Status indicator */}
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: state.running ? "#22c55e" : "#64748b",
                boxShadow: state.running ? "0 0 6px #22c55e" : "none",
              }}
            />
            <span className="text-xs" style={{ color: "#64748b" }}>
              {state.running ? "LIVE" : "OFFLINE"}
            </span>
          </div>
        </div>
      </header>

      {/* ── Visualizer ── */}
      <div className="px-4 pt-4 pb-2" style={{ height: "180px" }}>
        <div className="h-full rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <Visualizer getAnalysers={getAnalysers} running={state.running} />
        </div>
      </div>

      {/* ── Transport ── */}
      <div className="px-4 py-3 flex items-center gap-4">
        {/* Start / Stop */}
        <button
          onClick={state.running ? stop : start}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 active:scale-95"
          style={
            state.running
              ? { background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }
              : { background: "linear-gradient(135deg,#a855f7,#00d4ff)", color: "#000", fontWeight: 700 }
          }
        >
          <span className="text-base">{state.running ? "⏹" : "🎙️"}</span>
          {state.running ? "STOP" : "START"}
        </button>

        {/* Mute */}
        {state.running && (
          <button
            onClick={toggleMute}
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 active:scale-95"
            style={{
              background: state.muted ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.05)",
              color: state.muted ? "#ef4444" : "#94a3b8",
              border: `1px solid ${state.muted ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.08)"}`,
            }}
          >
            {state.muted ? "🔇 Muted" : "🔊 Mute"}
          </button>
        )}

        {/* Master volume */}
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-xs" style={{ color: "#64748b" }}>MASTER</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={state.masterVolume}
            onChange={e => setMasterVolume(parseFloat(e.target.value))}
            className="w-28 h-1.5 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: "#00d4ff" }}
          />
          <span className="text-xs font-mono w-8 text-right" style={{ color: "#00d4ff" }}>
            {Math.round(state.masterVolume * 100)}
          </span>
        </div>
      </div>

      {/* ── Effects Rack ── */}
      <div className="flex-1 px-4 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {EFFECT_META.map(({ key, icon, title, color }) => (
            <EffectCard
              key={key}
              effectKey={key}
              effect={state.effects[key]}
              color={color}
              icon={icon}
              title={title}
              onToggle={() => handleToggle(key)}
              onParam={patch => updateEffect(key, patch as never)}
            />
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="px-6 py-3 text-center border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
        <p className="text-xs" style={{ color: "#334155" }}>
          All processing happens locally in your browser · No audio is transmitted
        </p>
      </footer>
    </div>
  );
}
