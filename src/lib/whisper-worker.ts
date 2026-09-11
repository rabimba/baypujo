"use strict";
/* Whisper-base ASR worker — Transformers.js on WASM/CPU.
 *
 * Deliberately NOT WebGPU: the LLM worker holds the GPU adapter while
 * Kartik is running, and whisper's session creation on a busy adapter
 * can hang indefinitely (never rejects — so a .catch() fallback never
 * fires). WASM q8 transcribes 3-10s clips in ~2-6s, plenty for this
 * use case, with zero GPU contention.
 *
 * Posts {loading, note} during model fetch so the UI can show progress,
 * and {ok, text|error} with the result. An in-worker watchdog guarantees
 * no silent hangs: if inference produces nothing in 90s, we report. */
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

function getAsr(): Promise<AsrFn> {
  if (!asrPromise) {
    asrPromise = pipeline(
      "automatic-speech-recognition",
      "onnx-community/whisper-base",
      {
        dtype: "q8",
        device: "wasm",
        progress_callback: (p: {
          status?: string;
          progress?: number;
          file?: string;
        }) => {
          if (p?.status === "progress" && /\.onnx(_data)?$/.test(p.file ?? "")) {
            self.postMessage({
              loading: true,
              note: `Voice model ${Math.round(p.progress ?? 0)}%`,
            });
          } else if (p?.status === "ready" || p?.status === "done") {
            self.postMessage({ loading: true, note: "Voice model ready" });
          }
        },
      },
    ) as unknown as Promise<AsrFn>;
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

self.onmessage = async (e: MessageEvent) => {
  const data = e.data as {
    audio?: Float32Array;
    language?: string;
    warm?: boolean;
  };
  // Pre-warm request: build the pipeline now, no audio to run.
  if (data.warm) {
    try {
      self.postMessage({ loading: true, note: "Voice model loading…" });
      await getAsr();
      self.postMessage({ warm: true });
    } catch (err) {
      self.postMessage({
        ok: false,
        error: String((err as Error)?.message ?? err).slice(0, 200),
      });
    }
    return;
  }
  const audio = data.audio ?? new Float32Array(0);
  const _language = data.language; void _language;
  try {
    const dur = (audio.length / 16000).toFixed(1);
    self.postMessage({
      loading: true,
      note: `Loading voice model… (${dur}s of audio)`,
    });
    const pipe = await getAsr();
      self.postMessage({ loading: true, note: "Transcribing…" });
    const out = await withWatchdog(
      pipe(audio, {
        task: "transcribe",
        // Force English: multilingual mode on marginal audio produces
        // hallucinated junk tokens ("you"). Our audience asks in English
        // or Banglish — English ASR transcribes both intelligibly.
        language: "en",
        return_timestamps: false,
      }),
      90000,
    );
    const text = (out.text ?? "").trim();
      self.postMessage({ ok: true, text });
  } catch (err) {
    // Real error text (fetch failed / wasm abort / watchdog) — the UI
    // surfaces it instead of silently returning empty text.
      self.postMessage({
      ok: false,
      error: String((err as Error)?.message ?? err).slice(0, 200),
    });
  }
};
