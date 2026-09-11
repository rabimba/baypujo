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
  private sampleRate = 16000;
  /** Actual context (capture) rate — set by ensureCtx. */
  private ctxRate = 16000;
  private speaking = false;
  private lastLevelAt = 0;
  /** Auto-stop: speech-end detection state. */
  private voiceStartAt = 0;
  private silenceMs = 0;
  private autoStopTimer: ReturnType<typeof setInterval> | null = null;
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

  private async ensureCtx() {
    if (!this.ctx) {
      // Native rate (e.g. 48k). Chrome does NOT reliably resample a mic
      // stream into a constrained-rate context (echoCancellation path) —
      // buffers arrive at the track's rate regardless, so we resample
      // ourselves before whisper. see crbug 40558768.
      this.ctx = new AudioContext();
      // Passthrough capture worklet. Chrome only pulls audio through nodes
      // that reach the destination, so the panel output is routed via a
      // zero-gain sink (silence out, data in).
      const src = `class RecProc extends AudioWorkletProcessor {
        process(inputs) {
          const ch = inputs[0]?.[0];
          if (ch) this.port.postMessage(ch.slice(0));
          return true;
        }
      }
      registerProcessor("rec", RecProc);`;
      const url = URL.createObjectURL(
        new Blob([src], { type: "application/javascript" }),
      );
      await this.ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.ctxRate = this.ctx.sampleRate;
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
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    this.source = this.ctx!.createMediaStreamSource(this.stream);
    this.workletNode = new AudioWorkletNode(this.ctx!, "rec");
    this.sinkGain = this.ctx!.createGain();
    this.sinkGain.gain.value = 0; // pull the graph, emit silence
    this.voiceStartAt = 0;
    this.silenceMs = 0;
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
          onLevel(Math.min(1, peak * 3));
        }
      }
      // Speech-end VAD: voiced (peak>~0.02) marks speech; 1.2s of
      // silence AFTER ≥0.6s of speech auto-stops the recording.
      const voiced = peak > 0.02;
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
    this.autoStopTimer = null; // (kept for future use; VAD runs inline)
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
    const worker = this.ensureWhisper();
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { warm?: boolean; loading?: boolean; note?: string };
      if (d?.loading) onStatus?.(d.note ?? "Voice model loading…");
      if (d?.warm) worker.removeEventListener("message", onMsg);
    };
    worker.addEventListener("message", onMsg);
    worker.postMessage({ warm: true });
  }

  /** Stop capture; transcribes via whisper-base; resolves text or error. */
  async stopListening(onStatus?: StatusFn): Promise<SpeechResult> {
    this.onAutoStop = null;
    if (this.hardStopTimer) {
      clearTimeout(this.hardStopTimer);
      this.hardStopTimer = null;
    }
    this.workletNode?.port.close();
    this.workletNode?.disconnect();
    this.sinkGain?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.workletNode = null;
    this.sinkGain = null;
    this.source = null;
    this.stream = null;

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

    const worker = this.ensureWhisper();
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
          loading?: boolean;
          note?: string;
          ok?: boolean;
          text?: string;
          error?: string;
        };
        if (d?.loading) {
          armTimeout();
          onStatus?.(d.note ?? "Loading voice model…");
          return;
        }
        if (d?.ok !== undefined) {
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
      worker.postMessage({ audio });
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

  isSpeaking(): boolean {
    return this.speaking;
  }

  dispose(): void {
    this.stopSpeaking();
    this.whisperWorker?.terminate();
    this.whisperWorker = null;
    void this.ctx?.close();
    this.ctx = null;
  }
}
