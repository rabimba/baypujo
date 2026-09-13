/** Voice I/O for the assistant — mic capture → Whisper worker; speechSynthesis out. */

export interface SpeechResult {
  text: string;
  error?: string;
}

/** Linear resample to whisper's 16kHz. Speech bandwidth makes linear
 *  interpolation entirely adequate for ASR. */
function resampleTo16k(input: Float32Array, fromRate: number): Float32Array {
  if (fromRate === 16000 || fromRate === 0) return input;
  const ratio = fromRate / 16000;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = pos - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

type StatusFn = (note: string) => void;

export class VoiceIO {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sinkGain: GainNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private whisperWorker: Worker | null = null;
  private chunks: Float32Array[] = [];
  /** Actual context (capture) rate — set by ensureCtx. */
  private ctxRate = 16000;
  private speaking = false;
  private lastLevelAt = 0;
  /** Auto-stop: speech-end detection state. */
  private voiceStartAt = 0;
  /** Last capture diagnostics (rate, seconds, peak, non-zero ratio). */
  lastCapture: {
    ctxRate: number;
    nativeSamples: number;
    seconds: number;
    peak: number;
    normalized: boolean;
    nonZeroRatio: number;
    resampledSamples: number;
  } | null = null;
  private silenceMs = 0;
  private prewarmed = false;
  private asrSeq = 0;
  /** Adaptive VAD calibration state. */
  private vadFloor = 0;
  private vadFrames = 0;
  private onAutoStop: (() => void) | null = null;
  private hardStopTimer: ReturnType<typeof setTimeout> | null = null;

  /** Runs a feature probe; resolves false when mic/ASR can't work here. */
  static async capable(): Promise<boolean> {
    return (
      typeof window !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof AudioWorkletNode !== "undefined" &&
      typeof window.speechSynthesis !== "undefined"
    );
  }

  private workletSrc = `class RecProc extends AudioWorkletProcessor {
    process(inputs) {
      const ch = inputs[0]?.[0];
      if (ch) this.port.postMessage(ch.slice(0));
      return true;
    }
  }
  registerProcessor("rec", RecProc);`;

  /** Open (or reopen) an AudioContext at exactly `rate` with the capture
   *  worklet loaded. Chrome never resamples a mic stream to match a
   *  context (crbug 40558768) — buffers arrive at the TRACK's rate no
   *  matter the context rate, so the only correct setup is context rate
   *  == track rate. */
  private async openCtxAt(rate: number): Promise<void> {
    const old = this.ctx;
    this.ctx = null;
    if (old && old.state !== "closed") await old.close().catch(() => {});
    try {
      // Must actually REQUEST the rate — `new AudioContext({})` silently
      // gives the device default (44.1k here) and re-creates the very
      // mismatch this function exists to remove.
      this.ctx = new AudioContext({ sampleRate: rate });
    } catch {
      // Some rates are rejected outright; fall back to the default and
      // let resampleTo16k handle whatever we get.
      this.ctx = new AudioContext();
    }
    // Passthrough capture worklet. Chrome only pulls audio through nodes
    // that reach the destination, so the panel output is routed via a
    // zero-gain sink (silence out, data in).
    const url = URL.createObjectURL(
      new Blob([this.workletSrc], { type: "application/javascript" }),
    );
    await this.ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.ctxRate = this.ctx.sampleRate;
  }

  private async ensureCtx(): Promise<void> {
    if (this.ctx && this.ctx.state !== "closed") {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      this.ctxRate = this.ctx.sampleRate;
      return;
    }
    await this.openCtxAt(16000);
  }

  private ensureWhisper(): Worker {
    if (!this.whisperWorker) {
      this.whisperWorker = new Worker(
        new URL("./whisper-worker.ts", import.meta.url),
        { type: "module" },
      );
    }
    return this.whisperWorker;
  }

  /**
   * Start capture. Push-to-talk: click again to stop — and speech-end
   * auto-stop fires ~1.2s after you stop talking (requires ≥0.6s of
   * speech first so a brief cough doesn't cut you off). A 25s hard cap
   * guards against a stuck open mic.
   */
  async startListening(
    onLevel?: (peak: number) => void,
    onAutoStop?: () => void,
  ): Promise<void> {
    await this.ensureCtx();
    this.chunks = [];
    // echoCancellation OFF (crbug 40558768: EC path never resamples to
    // the context rate — the chipmunk bug), but autoGainControl ON:
    // quiet mics (measured peak 0.009 speech) are unrecoverable by
    // whisper-base without OS-level gain.
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true,
      },
    });
    // Align the context to the track's ACTUAL rate — the only pairing
    // that yields correctly-timed buffers (measured: 16k track through a
    // 44.1k context delivered 41.2k samples/s of duplicated audio).
    const trackRate =
      this.stream.getAudioTracks()[0]?.getSettings().sampleRate ?? 16000;
    if (trackRate && Math.abs(trackRate - this.ctxRate) > 1) {
      await this.openCtxAt(trackRate);
      // capture only from now (context was rebuilt)
      this.chunks = [];
    }
    this.source = this.ctx!.createMediaStreamSource(this.stream);
    this.workletNode = new AudioWorkletNode(this.ctx!, "rec");
    this.sinkGain = this.ctx!.createGain();
    this.sinkGain.gain.value = 0; // pull the graph, emit silence
    this.voiceStartAt = 0;
    this.silenceMs = 0;
    this.vadFloor = 0;
    this.vadFrames = 0;
    this.onAutoStop = onAutoStop ?? null;
    this.workletNode.port.onmessage = (e: MessageEvent) => {
      const buf = e.data as Float32Array;
      this.chunks.push(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i += 16) {
        const v = Math.abs(buf[i]);
        if (v > peak) peak = v;
      }
      if (onLevel) {
        const now = performance.now();
        if (now - this.lastLevelAt > 80) {
          this.lastLevelAt = now;
          onLevel(peak); // raw 0..1; the caller scales for display
        }
      }
      // Speech-end VAD with an adaptive floor: average the room over the
      // first ~300ms, then voiced = peak > max(0.006, floor * 3).
      // (A fixed 0.025 missed quiet-mic speech entirely — measured peak
      // 0.009 on the target machine.) The floor is capped so that
      // talking immediately — which calibrates on speech — can't push
      // the threshold above every later word and disable auto-stop.
      const calFrames = Math.max(8, Math.round((this.ctxRate * 0.3) / 128));
      if (this.vadFrames < calFrames) {
        this.vadFloor += peak / calFrames;
        this.vadFrames++;
      }
      const floor = Math.min(0.08, Math.max(0.006, this.vadFloor * 3));
      const voiced = peak > floor;
      if (voiced) {
        this.voiceStartAt = this.voiceStartAt || performance.now();
        this.silenceMs = 0;
      } else if (this.voiceStartAt) {
        this.silenceMs += (buf.length / this.ctxRate) * 1000;
        if (this.silenceMs >= 1200 && this.onAutoStop) {
          const stop = this.onAutoStop;
          this.onAutoStop = null; // fire once
          stop();
        }
      }
    };
    this.hardStopTimer = setTimeout(() => {
      const stop = this.onAutoStop;
      this.onAutoStop = null;
      stop?.();
    }, 25000);
    this.source.connect(this.workletNode);
    this.workletNode.connect(this.sinkGain);
    this.sinkGain.connect(this.ctx!.destination);
    // Echo guard: stop any playing speech while the mic is open.
    if (this.speaking) this.stopSpeaking();
  }

  /**
   * Pre-warm the whisper worker (model download + session init) without
   * any audio. Fire-and-forget; result cached in the worker.
   */
  prewarm(onStatus?: StatusFn): void {
    if (this.prewarmed) return;
    this.prewarmed = true;
    const worker = this.ensureWhisper();
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; note?: string; error?: string };
      if (d?.type === "progress") onStatus?.(d.note ?? "Voice model loading…");
      if (d?.type === "warm-done") {
        // Never surfaces as a transcription failure: a prewarm error just
        // means the first real question pays the download cost again.
        worker.removeEventListener("message", onMsg);
        if (d.error) this.prewarmed = false;
      }
    };
    worker.addEventListener("message", onMsg);
    worker.postMessage({ type: "warm" });
  }

  /** Stop capture; transcribes via whisper-base; resolves text or error. */
  async stopListening(onStatus?: StatusFn): Promise<SpeechResult> {
    this.teardownCapture();

    // Snapshot + clear under one tick: the worklet port may still deliver
    // queued buffers after close, which previously corrupted the copy
    // (Float32Array.set "offset is out of bounds").
    const captured = this.chunks;
    this.chunks = [];
    const total = captured.reduce((a, c) => a + c.length, 0);
    // <0.4s of audio = mic opened but nothing said (at capture rate)
    if (total < this.ctxRate * 0.4) {
      return {
        text: "",
        error: "Barely anything recorded — tap 🎤 and speak a full question.",
      };
    }
    const native = new Float32Array(total);
    let off = 0;
    for (const c of captured) {
      // clamp: never write past the end regardless of what arrived
      const n = Math.min(c.length, total - off);
      if (n <= 0) break;
      native.set(n === c.length ? c : c.subarray(0, n), off);
      off += n;
    }

    const audio = resampleTo16k(native, this.ctxRate);

    // Normalize: even with autoGainControl, quiet mics deliver speech
    // near peak 0.01 that whisper decodes as [BLANK_AUDIO]. Scale usable
    // audio up to a ~0.5 peak (skip clips that are already loud, or so
    // close to silence that amplifying only raises the noise).
    let peak = 0;
    let nonzero = 0;
    for (let i = 0; i < audio.length; i++) {
      const v = Math.abs(audio[i]);
      if (v > peak) peak = v;
      if (v > 0.001) nonzero++;
    }
    const normalized = peak > 0.002 && peak < 0.35;
    if (normalized) {
      const gain = Math.min(40, 0.5 / peak);
      for (let i = 0; i < audio.length; i++) {
        audio[i] = Math.max(-1, Math.min(1, audio[i] * gain));
      }
    }

    // capture diagnostics — surfaced to console + VoiceIO.lastCapture
    this.lastCapture = {
      ctxRate: this.ctxRate,
      nativeSamples: native.length,
      seconds: +(native.length / (this.ctxRate || 16000)).toFixed(2),
      peak: +peak.toFixed(3),
      normalized: normalized,
      nonZeroRatio: +(nonzero / Math.max(1, audio.length)).toFixed(3),
      resampledSamples: audio.length,
    };
    console.info(
      "[voice] captured",
      JSON.stringify(this.lastCapture),
    );

    const worker = this.ensureWhisper();
    const id = ++this.asrSeq;
    return new Promise<SpeechResult>((resolve) => {
      // Load-aware watchdog: the first run downloads ~45MB of weights;
      // reset the timer whenever a progress note arrives so a legit
      // download never races the timeout. True stalls (no notes for
      // 120s) still fire.
      let timeout: ReturnType<typeof setTimeout> = setTimeout(onTimeout, 120000);
      function armTimeout() {
        clearTimeout(timeout);
        timeout = setTimeout(onTimeout, 120000);
      }
      function onTimeout() {
        cleanup();
        resolve({ text: "", error: "Transcription timed out — try again." });
      }
      const onMsg = (e: MessageEvent) => {
        const d = e.data as {
          type?: string;
          id?: number;
          note?: string;
          ok?: boolean;
          text?: string;
          error?: string;
        };
        if (d?.type === "progress") {
          armTimeout();
          onStatus?.(d.note ?? "Loading voice model…");
          return;
        }
        // Only this request's result — a concurrent prewarm posts its own
        // messages on the same port.
        if (d?.type === "result" && d.id === id) {
          cleanup();
          resolve(
            d.ok
              ? { text: (d.text ?? "").trim() }
              : { text: "", error: d.error ?? "Transcription failed" },
          );
        }
      };
      const cleanup = () => {
        clearTimeout(timeout);
        worker.removeEventListener("message", onMsg);
      };
      worker.addEventListener("message", onMsg);
      onStatus?.("Transcribing…");
      worker.postMessage({ type: "asr", id, audio });
    });
  }

  /** Speak text through the browser's voices. */
  speak(text: string, lang = "en-US"): void {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = /[\u0980-\u09FF]/.test(text) ? "bn-IN" : lang;
    const voices = synth.getVoices();
    const v =
      voices.find((x) => x.lang === u.lang) ??
      voices.find((x) => x.lang.startsWith(u.lang.split("-")[0]));
    if (v) u.voice = v;
    u.onstart = () => {
      this.speaking = true;
    };
    u.onend = u.onerror = () => {
      this.speaking = false;
    };
    synth.speak(u);
  }

  stopSpeaking(): void {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.speaking = false;
  }

  /** Tear down capture nodes and release the mic (browser indicator off). */
  private teardownCapture(): void {
    if (this.hardStopTimer) {
      clearTimeout(this.hardStopTimer);
      this.hardStopTimer = null;
    }
    this.onAutoStop = null;
    try {
      this.workletNode?.port.close();
    } catch {
      /* already closed */
    }
    this.workletNode?.disconnect();
    this.sinkGain?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.workletNode = null;
    this.sinkGain = null;
    this.source = null;
    this.stream = null;
  }

  dispose(): void {
    this.stopSpeaking();
    // Closing the panel mid-recording must not leave the mic live.
    this.teardownCapture();
    this.chunks = [];
    this.whisperWorker?.terminate();
    this.whisperWorker = null;
    void this.ctx?.close();
    this.ctx = null;
  }
}
