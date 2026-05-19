"use client";

import { useRef, useState, useCallback } from "react";

export type FilterType = "lowpass" | "highpass" | "bandpass" | "notch";

export interface EffectsState {
  filter: { enabled: boolean; type: FilterType; frequency: number; resonance: number };
  distortion: { enabled: boolean; drive: number; tone: number };
  delay: { enabled: boolean; time: number; feedback: number; mix: number };
  reverb: { enabled: boolean; decay: number; mix: number };
  tremolo: { enabled: boolean; rate: number; depth: number };
  chorus: { enabled: boolean; rate: number; depth: number; mix: number };
  flanger: { enabled: boolean; rate: number; depth: number; feedback: number };
  compressor: { enabled: boolean; threshold: number; ratio: number };
  bitCrusher: { enabled: boolean; bits: number; mix: number };
}

export interface EngineState {
  running: boolean;
  muted: boolean;
  masterVolume: number;
  effects: EffectsState;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function makeDistortionCurve(drive: number): Float32Array<ArrayBuffer> {
  const n = 512;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const k = drive * 3;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function makeBitCrusherCurve(bits: number): Float32Array<ArrayBuffer> {
  const n = 65536;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const step = 2 / Math.pow(2, Math.max(1, bits));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = step * Math.round(x / step);
  }
  return curve;
}

function makeReverbBuffer(ctx: AudioContext, decay: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * Math.max(0.1, decay));
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5);
    }
  }
  return buf;
}

// ── node bag ─────────────────────────────────────────────────────────────────

interface AudioNodes {
  ctx: AudioContext;
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  inputGain: GainNode;
  masterGain: GainNode;
  muteGain: GainNode;
  analyserIn: AnalyserNode;
  analyserOut: AnalyserNode;

  // filter
  filterDry: GainNode; filterWet: GainNode; filterNode: BiquadFilterNode;

  // distortion
  distDry: GainNode; distWet: GainNode; distNode: WaveShaperNode; distTone: BiquadFilterNode;

  // delay
  delayDry: GainNode; delayWet: GainNode; delayNode: DelayNode; delayFeedback: GainNode;

  // reverb
  reverbDry: GainNode; reverbWet: GainNode; reverbNode: ConvolverNode;

  // tremolo
  tremoloGain: GainNode; tremoloLFO: OscillatorNode; tremoloLFOGain: GainNode;

  // chorus
  chorusDry: GainNode; chorusWet: GainNode;
  chorusDelays: DelayNode[]; chorusLFOs: OscillatorNode[]; chorusLFOGains: GainNode[];

  // flanger
  flangerDry: GainNode; flangerWet: GainNode;
  flangerDelay: DelayNode; flangerFeedback: GainNode;
  flangerLFO: OscillatorNode; flangerLFOGain: GainNode;

  // compressor
  compNode: DynamicsCompressorNode;

  // bit crusher
  bitDry: GainNode; bitWet: GainNode; bitNode: WaveShaperNode;
}

const DEFAULT_EFFECTS: EffectsState = {
  filter:     { enabled: false, type: "lowpass", frequency: 2000, resonance: 1 },
  distortion: { enabled: false, drive: 30, tone: 3000 },
  delay:      { enabled: false, time: 0.35, feedback: 0.4, mix: 0.45 },
  reverb:     { enabled: false, decay: 2.5, mix: 0.4 },
  tremolo:    { enabled: false, rate: 4, depth: 0.7 },
  chorus:     { enabled: false, rate: 1.2, depth: 6, mix: 0.5 },
  flanger:    { enabled: false, rate: 0.4, depth: 4, feedback: 0.6 },
  compressor: { enabled: false, threshold: -24, ratio: 4 },
  bitCrusher: { enabled: false, bits: 6, mix: 0.6 },
};

// ── main hook ─────────────────────────────────────────────────────────────────

export function useAudioEngine() {
  const nodesRef = useRef<AudioNodes | null>(null);

  const [state, setState] = useState<EngineState>({
    running: false,
    muted: false,
    masterVolume: 0.85,
    effects: DEFAULT_EFFECTS,
  });

  // ── build graph ──────────────────────────────────────────────────────────

  const buildGraph = useCallback((ctx: AudioContext, stream: MediaStream): AudioNodes => {
    const e = state.effects;

    const source = ctx.createMediaStreamSource(stream);
    const inputGain = ctx.createGain();
    const masterGain = ctx.createGain();
    const muteGain = ctx.createGain();
    masterGain.gain.value = state.masterVolume;

    const analyserIn = ctx.createAnalyser();
    analyserIn.fftSize = 2048;
    const analyserOut = ctx.createAnalyser();
    analyserOut.fftSize = 2048;

    // ── filter ──
    const filterDry = ctx.createGain();
    const filterWet = ctx.createGain();
    const filterNode = ctx.createBiquadFilter();
    filterNode.type = e.filter.type;
    filterNode.frequency.value = e.filter.frequency;
    filterNode.Q.value = e.filter.resonance;
    setMix(filterDry, filterWet, e.filter.enabled, 1);

    // ── distortion ──
    const distDry = ctx.createGain();
    const distWet = ctx.createGain();
    const distNode = ctx.createWaveShaper();
    distNode.curve = makeDistortionCurve(e.distortion.drive);
    distNode.oversample = "4x";
    const distTone = ctx.createBiquadFilter();
    distTone.type = "lowpass";
    distTone.frequency.value = e.distortion.tone;
    setMix(distDry, distWet, e.distortion.enabled, 1);

    // ── delay ──
    const delayDry = ctx.createGain();
    const delayWet = ctx.createGain();
    const delayNode = ctx.createDelay(2.0);
    delayNode.delayTime.value = e.delay.time;
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = e.delay.feedback;
    setMix(delayDry, delayWet, e.delay.enabled, e.delay.mix);

    // ── reverb ──
    const reverbDry = ctx.createGain();
    const reverbWet = ctx.createGain();
    const reverbNode = ctx.createConvolver();
    reverbNode.buffer = makeReverbBuffer(ctx, e.reverb.decay);
    setMix(reverbDry, reverbWet, e.reverb.enabled, e.reverb.mix);

    // ── tremolo ──
    const tremoloGain = ctx.createGain();
    tremoloGain.gain.value = 1;
    const tremoloLFO = ctx.createOscillator();
    const tremoloLFOGain = ctx.createGain();
    tremoloLFO.type = "sine";
    tremoloLFO.frequency.value = e.tremolo.rate;
    tremoloLFOGain.gain.value = e.tremolo.enabled ? e.tremolo.depth / 2 : 0;
    tremoloLFO.connect(tremoloLFOGain);
    tremoloLFOGain.connect(tremoloGain.gain);
    tremoloLFO.start();

    // ── chorus (3 voices) ──
    const chorusDry = ctx.createGain();
    const chorusWet = ctx.createGain();
    const chorusDelays: DelayNode[] = [];
    const chorusLFOs: OscillatorNode[] = [];
    const chorusLFOGains: GainNode[] = [];
    for (let i = 0; i < 3; i++) {
      const d = ctx.createDelay(0.1);
      d.delayTime.value = 0.015 + i * 0.005;
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = e.chorus.rate + i * 0.15;
      const lg = ctx.createGain();
      lg.gain.value = (e.chorus.depth / 1000) * (e.chorus.enabled ? 1 : 0);
      lfo.connect(lg);
      lg.connect(d.delayTime);
      lfo.start();
      chorusDelays.push(d);
      chorusLFOs.push(lfo);
      chorusLFOGains.push(lg);
    }
    setMix(chorusDry, chorusWet, e.chorus.enabled, e.chorus.mix);

    // ── flanger ──
    const flangerDry = ctx.createGain();
    const flangerWet = ctx.createGain();
    const flangerDelay = ctx.createDelay(0.02);
    flangerDelay.delayTime.value = 0.005;
    const flangerFeedback = ctx.createGain();
    flangerFeedback.gain.value = e.flanger.enabled ? e.flanger.feedback : 0;
    const flangerLFO = ctx.createOscillator();
    flangerLFO.type = "sine";
    flangerLFO.frequency.value = e.flanger.rate;
    const flangerLFOGain = ctx.createGain();
    flangerLFOGain.gain.value = e.flanger.enabled ? (e.flanger.depth / 1000) : 0;
    flangerLFO.connect(flangerLFOGain);
    flangerLFOGain.connect(flangerDelay.delayTime);
    flangerLFO.start();
    setMix(flangerDry, flangerWet, e.flanger.enabled, 0.5);

    // ── compressor ──
    const compNode = ctx.createDynamicsCompressor();
    compNode.threshold.value = e.compressor.enabled ? e.compressor.threshold : 0;
    compNode.ratio.value = e.compressor.enabled ? e.compressor.ratio : 1;
    compNode.attack.value = 0.003;
    compNode.release.value = 0.25;

    // ── bit crusher ──
    const bitDry = ctx.createGain();
    const bitWet = ctx.createGain();
    const bitNode = ctx.createWaveShaper();
    bitNode.curve = makeBitCrusherCurve(e.bitCrusher.bits);
    setMix(bitDry, bitWet, e.bitCrusher.enabled, e.bitCrusher.mix);

    // ── wiring ──────────────────────────────────────────────────────────────
    // Each effect: signal → [dryNode → out] + [processing → wetNode → out]
    // Chain of effect outputs feeds the next input

    const nodes: AudioNodes = {
      ctx, stream, source, inputGain, masterGain, muteGain,
      analyserIn, analyserOut,
      filterDry, filterWet, filterNode,
      distDry, distWet, distNode, distTone,
      delayDry, delayWet, delayNode, delayFeedback,
      reverbDry, reverbWet, reverbNode,
      tremoloGain, tremoloLFO, tremoloLFOGain,
      chorusDry, chorusWet, chorusDelays, chorusLFOs, chorusLFOGains,
      flangerDry, flangerWet, flangerDelay, flangerFeedback, flangerLFO, flangerLFOGain,
      compNode,
      bitDry, bitWet, bitNode,
    };

    // ── connect the chain ──
    source.connect(inputGain);
    inputGain.connect(analyserIn);

    // Chain: analyserIn → filter → dist → delay → reverb → tremolo → chorus → flanger → comp → bit → analyserOut
    function chainEffect(
      input: AudioNode,
      dry: GainNode,
      wet: GainNode,
      output: GainNode,
      ...processing: AudioNode[]
    ): GainNode {
      input.connect(dry);
      dry.connect(output);
      let prev: AudioNode = input;
      for (const node of processing) {
        prev.connect(node);
        prev = node;
      }
      prev.connect(wet);
      wet.connect(output);
      return output;
    }

    const filterOut = ctx.createGain();
    chainEffect(analyserIn, filterDry, filterWet, filterOut, filterNode);

    const distOut = ctx.createGain();
    chainEffect(filterOut, distDry, distWet, distOut, distNode, distTone);

    const delayOut = ctx.createGain();
    distOut.connect(delayDry);
    delayDry.connect(delayOut);
    distOut.connect(delayNode);
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(delayWet);
    delayWet.connect(delayOut);

    const reverbOut = ctx.createGain();
    chainEffect(delayOut, reverbDry, reverbWet, reverbOut, reverbNode);

    // tremolo wraps signal through a gain modulated by LFO
    reverbOut.connect(tremoloGain);
    const tremoloOut = tremoloGain;

    // chorus
    const chorusOut = ctx.createGain();
    tremoloOut.connect(chorusDry);
    chorusDry.connect(chorusOut);
    for (const d of chorusDelays) {
      tremoloOut.connect(d);
      d.connect(chorusWet);
    }
    chorusWet.connect(chorusOut);

    // flanger
    const flangerOut = ctx.createGain();
    chorusOut.connect(flangerDry);
    flangerDry.connect(flangerOut);
    chorusOut.connect(flangerDelay);
    flangerDelay.connect(flangerFeedback);
    flangerFeedback.connect(flangerDelay);
    flangerDelay.connect(flangerWet);
    flangerWet.connect(flangerOut);

    // compressor (always in chain, params control intensity)
    flangerOut.connect(compNode);

    // bit crusher
    const bitOut = ctx.createGain();
    compNode.connect(bitDry);
    bitDry.connect(bitOut);
    compNode.connect(bitNode);
    bitNode.connect(bitWet);
    bitWet.connect(bitOut);

    bitOut.connect(analyserOut);
    analyserOut.connect(masterGain);
    masterGain.connect(muteGain);
    muteGain.connect(ctx.destination);

    return nodes;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── start ────────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const ctx = new AudioContext();
      if (ctx.state === "suspended") await ctx.resume();

      const nodes = buildGraph(ctx, stream);
      nodesRef.current = nodes;

      setState(prev => ({ ...prev, running: true }));
    } catch (err) {
      console.error("Microphone error:", err);
      alert("Microphone access is required. Please allow microphone and try again.");
    }
  }, [buildGraph]);

  // ── stop ─────────────────────────────────────────────────────────────────

  const stop = useCallback(() => {
    const n = nodesRef.current;
    if (!n) return;

    n.tremoloLFO.stop();
    n.flangerLFO.stop();
    n.chorusLFOs.forEach(l => l.stop());

    n.source.disconnect();
    n.stream.getTracks().forEach(t => t.stop());
    n.ctx.close();
    nodesRef.current = null;
    setState(prev => ({ ...prev, running: false }));
  }, []);

  // ── mute ─────────────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    setState(prev => {
      const muted = !prev.muted;
      if (nodesRef.current) {
        nodesRef.current.muteGain.gain.setTargetAtTime(muted ? 0 : 1, nodesRef.current.ctx.currentTime, 0.02);
      }
      return { ...prev, muted };
    });
  }, []);

  const setMasterVolume = useCallback((v: number) => {
    setState(prev => {
      if (nodesRef.current) {
        nodesRef.current.masterGain.gain.setTargetAtTime(v, nodesRef.current.ctx.currentTime, 0.02);
      }
      return { ...prev, masterVolume: v };
    });
  }, []);

  // ── effect toggles & param updates ───────────────────────────────────────

  const updateEffect = useCallback(<K extends keyof EffectsState>(
    key: K,
    patch: Partial<EffectsState[K]>,
  ) => {
    setState(prev => {
      const next = { ...prev.effects, [key]: { ...prev.effects[key], ...patch } };
      applyToNodes(nodesRef.current, key, next[key] as never);
      return { ...prev, effects: next };
    });
  }, []);

  // ── getters for visualiser ────────────────────────────────────────────────

  const getAnalysers = useCallback(() => {
    if (!nodesRef.current) return null;
    return { in: nodesRef.current.analyserIn, out: nodesRef.current.analyserOut };
  }, []);

  return { state, start, stop, toggleMute, setMasterVolume, updateEffect, getAnalysers };
}

// ── dry/wet helper ────────────────────────────────────────────────────────────

function setMix(dry: GainNode, wet: GainNode, enabled: boolean, mix: number) {
  if (!enabled) {
    dry.gain.value = 1;
    wet.gain.value = 0;
  } else {
    dry.gain.value = 1 - mix;
    wet.gain.value = mix;
  }
}

// ── live node updates (no re-render needed) ───────────────────────────────────

function applyToNodes(n: AudioNodes | null, key: string, p: never) {
  if (!n) return;
  const t = n.ctx.currentTime;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = p as any;

  switch (key) {
    case "filter":
      n.filterNode.type = e.type;
      n.filterNode.frequency.setTargetAtTime(e.frequency, t, 0.01);
      n.filterNode.Q.setTargetAtTime(e.resonance, t, 0.01);
      setMix(n.filterDry, n.filterWet, e.enabled, 1);
      break;

    case "distortion":
      n.distNode.curve = makeDistortionCurve(e.drive);
      n.distTone.frequency.setTargetAtTime(e.tone, t, 0.01);
      setMix(n.distDry, n.distWet, e.enabled, 1);
      break;

    case "delay":
      n.delayNode.delayTime.setTargetAtTime(e.time, t, 0.01);
      n.delayFeedback.gain.setTargetAtTime(e.feedback, t, 0.01);
      setMix(n.delayDry, n.delayWet, e.enabled, e.mix);
      break;

    case "reverb":
      n.reverbNode.buffer = makeReverbBuffer(n.ctx, e.decay);
      setMix(n.reverbDry, n.reverbWet, e.enabled, e.mix);
      break;

    case "tremolo":
      n.tremoloLFO.frequency.setTargetAtTime(e.rate, t, 0.01);
      n.tremoloLFOGain.gain.setTargetAtTime(e.enabled ? e.depth / 2 : 0, t, 0.01);
      break;

    case "chorus":
      n.chorusLFOs.forEach((lfo, i) => {
        lfo.frequency.setTargetAtTime(e.rate + i * 0.15, t, 0.01);
        n.chorusLFOGains[i].gain.setTargetAtTime(e.enabled ? e.depth / 1000 : 0, t, 0.01);
      });
      setMix(n.chorusDry, n.chorusWet, e.enabled, e.mix);
      break;

    case "flanger":
      n.flangerLFO.frequency.setTargetAtTime(e.rate, t, 0.01);
      n.flangerLFOGain.gain.setTargetAtTime(e.enabled ? e.depth / 1000 : 0, t, 0.01);
      n.flangerFeedback.gain.setTargetAtTime(e.enabled ? e.feedback : 0, t, 0.01);
      setMix(n.flangerDry, n.flangerWet, e.enabled, 0.5);
      break;

    case "compressor":
      n.compNode.threshold.setTargetAtTime(e.enabled ? e.threshold : 0, t, 0.01);
      n.compNode.ratio.setTargetAtTime(e.enabled ? e.ratio : 1, t, 0.01);
      break;

    case "bitCrusher":
      n.bitNode.curve = makeBitCrusherCurve(e.bits);
      setMix(n.bitDry, n.bitWet, e.enabled, e.mix);
      break;
  }
}
