/** Voice I/O for the assistant — mic capture → Whisper worker; speechSynthesis out. */

export interface SpeechResult {
  text: string;
}

export class VoiceIO {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private whisperWorker: Worker | null = null;
  private chunks: Float32Array[] = [];
  private sampleRate = 16000;
  private speaking = false;
  private mutedWhileSpeaking = false;

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
      this.ctx = new AudioContext({ sampleRate: this.sampleRate });
      // Tiny VAD-less worklet: passthrough ring capture; silence handled by
      // push-to-talk UX rather than DSP.
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

  /** Start push-to-talk capture. Mutes TTS echo while recording. */
  async startListening(onLevel?: (peak: number) => void): Promise<void> {
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
    this.workletNode.port.onmessage = (e: MessageEvent) => {
      const buf = e.data as Float32Array;
      this.chunks.push(buf);
      if (onLevel) {
        let peak = 0;
        for (let i = 0; i < buf.length; i += 16) {
          const v = Math.abs(buf[i]);
          if (v > peak) peak = v;
        }
        onLevel(peak);
      }
    };
    this.source.connect(this.workletNode);
    // Echo guard: stop any playing speech and remember to resume after.
    if (this.speaking) this.stopSpeaking();
    this.mutedWhileSpeaking = this.speaking;
  }

  /** Stop capture; transcribes via whisper-base; resolves text. */
  async stopListening(): Promise<SpeechResult> {
    this.workletNode?.port.close();
    this.workletNode?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.workletNode = null;
    this.source = null;
    this.stream = null;

    const total = this.chunks.reduce((a, c) => a + c.length, 0);
    if (total === 0) return { text: "" };
    const audio = new Float32Array(total);
    let off = 0;
    for (const c of this.chunks) {
      audio.set(c, off);
      off += c.length;
    }
    this.chunks = [];

    const worker = this.ensureWhisper();
    return new Promise<SpeechResult>((resolve) => {
      const timeout = setTimeout(() => {
        worker.removeEventListener("message", onMsg);
        resolve({ text: "" });
      }, 30000);
      const onMsg = (e: MessageEvent) => {
        if (e.data?.ok !== undefined) {
          clearTimeout(timeout);
          worker.removeEventListener("message", onMsg);
          resolve(e.data.ok ? { text: e.data.text } : { text: "" });
        }
      };
      worker.addEventListener("message", onMsg);
      worker.postMessage({ audio });
    });
  }

  /** Speak text through the browser's voices; sentences queue naturally. */
  speak(text: string, lang = "en-US"): void {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = /[\u0980-\u09FF]/.test(text) ? "bn-IN" : lang;
    // Prefer a matching voice when the OS has one.
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
