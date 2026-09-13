"use strict";
/* Whisper-base ASR worker — Transformers.js on WASM/CPU.
 *
 * Deliberately NOT WebGPU: the LLM worker holds the GPU adapter while
 * Kartik is running, and whisper's session creation on a busy adapter
 * can hang indefinitely (never rejects — so a .catch() fallback never
 * fires). WASM q8 transcribes 3-10s clips in ~2-6s, plenty for this
 * use case, with zero GPU contention.
 *
 * Every message carries a `type`, and transcription results carry the
 * request `id`: a prewarm failure must never resolve an unrelated
 * in-flight transcription. An in-worker watchdog guarantees no silent
 * hangs — if inference produces nothing in 90s, we report. */
import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;
// Single-threaded WASM: multi-thread needs SharedArrayBuffer which
// requires COOP/COEP headers GitHub Pages doesn't send.
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
}

type AsrFn = (
  audio: Float32Array,
  opts?: Record<string, unknown>,
) => Promise<{ text: string }>;

let asrPromise: Promise<AsrFn> | null = null;
let asrReady = false;

function getAsr(): Promise<AsrFn> {
  if (!asrPromise) {
    asrPromise = (
      pipeline("automatic-speech-recognition", "onnx-community/whisper-base", {
        dtype: "q8",
        device: "wasm",
        progress_callback: (p: {
          status?: string;
          progress?: number;
          file?: string;
        }) => {
          if (p?.status === "progress" && /\.onnx(_data)?$/.test(p.file ?? "")) {
            self.postMessage({
              type: "progress",
              note: `Voice model ${Math.round(p.progress ?? 0)}%`,
            });
          } else if (p?.status === "ready" || p?.status === "done") {
            self.postMessage({ type: "progress", note: "Voice model ready" });
          }
        },
      }) as unknown as Promise<AsrFn>
    ).then((fn) => {
      asrReady = true;
      return fn;
    });
  }
  return asrPromise;
}

/** Race an inference promise against a watchdog. */
function withWatchdog(
  p: Promise<{ text: string }>,
  ms: number,
): Promise<{ text: string }> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error("Transcription timed out — please try again.")),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

const errText = (err: unknown) =>
  String((err as Error)?.message ?? err).slice(0, 200);

self.onmessage = async (e: MessageEvent) => {
  const data = e.data as {
    type?: "warm" | "asr";
    id?: number;
    audio?: Float32Array;
  };

  // Pre-warm request: build the pipeline now, no audio to run.
  if (data.type === "warm") {
    try {
      self.postMessage({ type: "progress", note: "Voice model loading…" });
      await getAsr();
      self.postMessage({ type: "warm-done" });
    } catch (err) {
      self.postMessage({ type: "warm-done", error: errText(err) });
    }
    return;
  }

  if (data.type !== "asr") return;
  const id = data.id ?? 0;
  const audio = data.audio ?? new Float32Array(0);
  try {
    if (!asrReady) {
      const dur = (audio.length / 16000).toFixed(1);
      self.postMessage({
        type: "progress",
        note: `Loading voice model… (${dur}s of audio)`,
      });
    }
    const pipe = await getAsr();
    self.postMessage({ type: "progress", note: "Transcribing…" });
    const out = await withWatchdog(
      pipe(audio, {
        task: "transcribe",
        // Force English: multilingual mode on marginal audio produces
        // hallucinated junk tokens ("you"). Our audience asks in English
        // or Banglish — English ASR transcribes both intelligibly.
        // (Trade-off: pure Bengali speech transcribes poorly; typing
        // Bengali works fine.)
        language: "en",
        return_timestamps: false,
      }),
      90000,
    );
    self.postMessage({ type: "result", id, ok: true, text: (out.text ?? "").trim() });
  } catch (err) {
    // Real error text (fetch failed / wasm abort / watchdog) — the UI
    // surfaces it instead of silently returning empty text.
    self.postMessage({ type: "result", id, ok: false, error: errText(err) });
  }
};
