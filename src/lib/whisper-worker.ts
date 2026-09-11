"use strict";
/* Whisper-base ASR worker — Transformers.js on WebGPU (WASM fallback).
 * Posts {loading, note} during model fetch so the UI can show progress. */
import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;

type AsrFn = (
  audio: Float32Array,
  opts?: Record<string, unknown>,
) => Promise<{ text: string }>;

let asrPromise: Promise<AsrFn> | null = null;

function buildAsr(device: "webgpu" | "wasm"): Promise<AsrFn> {
  return pipeline(
    "automatic-speech-recognition",
    "onnx-community/whisper-base",
    {
      dtype: "q8",
      device,
      progress_callback: (p: { status?: string; progress?: number; file?: string }) => {
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

function getAsr(): Promise<AsrFn> {
  if (!asrPromise) {
    // Prefer WebGPU, but a busy GPU (LLM running) or missing EP support
    // can break the session — fall back to wasm instead of failing.
    const hasGpu = !!(navigator as Navigator & { gpu?: unknown }).gpu;
    asrPromise = hasGpu
      ? buildAsr("webgpu").catch(() => {
          self.postMessage({ loading: true, note: "Voice model (CPU mode)" });
          return buildAsr("wasm");
        })
      : buildAsr("wasm");
  }
  return asrPromise;
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
  const language = data.language;
  try {
    const dur = (audio.length / 16000).toFixed(1);
    self.postMessage({
      loading: true,
      note: `Loading voice model… (${dur}s of audio)`,
    });
    const pipe = await getAsr();
    self.postMessage({ loading: true, note: "Transcribing…" });
    const out = await pipe(audio, {
      task: "transcribe",
      language: language ?? null,
      return_timestamps: false,
    });
    const text = (out.text ?? "").trim();
    self.postMessage({ ok: true, text });
  } catch (err) {
    // Real error text (fetch failed / device lost / wasm abort) — the UI
    // surfaces it instead of silently returning empty text.
    self.postMessage({
      ok: false,
      error: String((err as Error)?.message ?? err).slice(0, 200),
    });
  }
};
