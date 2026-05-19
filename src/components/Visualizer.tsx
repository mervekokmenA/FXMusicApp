"use client";

import { useEffect, useRef } from "react";

interface Props {
  getAnalysers: () => { in: AnalyserNode; out: AnalyserNode } | null;
  running: boolean;
}

export default function Visualizer({ getAnalysers, running }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const analysers = getAnalysers();
      const { width: W, height: H } = canvas;

      // Clear
      ctx.fillStyle = "#07070f";
      ctx.fillRect(0, 0, W, H);

      if (!analysers || !running) {
        drawIdle(ctx, W, H);
        return;
      }

      const { out: analyser } = analysers;
      const bufLen = analyser.frequencyBinCount;
      const freqData = new Uint8Array(bufLen);
      const timeData = new Uint8Array(analyser.fftSize);
      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);

      // ── spectrum bars ──
      const barCount = Math.min(bufLen, 128);
      const barW = W / barCount;
      for (let i = 0; i < barCount; i++) {
        const t = i / barCount;
        const v = freqData[Math.floor((i / barCount) * bufLen)] / 255;
        const barH = v * H * 0.75;

        // gradient: purple → cyan
        const r = Math.round(168 + (0 - 168) * t);
        const g = Math.round(85 + (212 - 85) * t);
        const b = Math.round(247 + (255 - 247) * t);

        ctx.fillStyle = `rgba(${r},${g},${b},${0.15 + v * 0.6})`;
        ctx.fillRect(i * barW, H - barH, barW - 1, barH);

        // top glow cap
        ctx.fillStyle = `rgba(${r},${g},${b},${v})`;
        ctx.fillRect(i * barW, H - barH - 2, barW - 1, 2);
      }

      // ── waveform line ──
      const mid = H / 2;
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(0, 212, 255, 0.9)";
      ctx.shadowColor = "#00d4ff";
      ctx.shadowBlur = 8;

      for (let i = 0; i < timeData.length; i++) {
        const x = (i / timeData.length) * W;
        const y = mid + ((timeData[i] - 128) / 128) * (H * 0.3);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // ── center mirror line ──
      ctx.beginPath();
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.moveTo(0, mid);
      ctx.lineTo(W, mid);
      ctx.stroke();
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [getAnalysers, running]);

  // Fit canvas to parent on resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    });
    ro.observe(canvas);
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    return () => ro.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded-xl"
      style={{ display: "block" }}
    />
  );
}

function drawIdle(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const mid = H / 2;
  ctx.beginPath();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(0, 212, 255, 0.25)";

  for (let i = 0; i < W; i++) {
    const y = mid + Math.sin((i / W) * Math.PI * 6) * 6;
    if (i === 0) ctx.moveTo(i, y);
    else ctx.lineTo(i, y);
  }
  ctx.stroke();

  ctx.fillStyle = "rgba(100,116,139,0.5)";
  ctx.font = "13px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("Press START to activate microphone", W / 2, mid + 28);
}
