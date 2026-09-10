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

function getAsr(): Promise<AsrFn> {
  if (!asrPromise) {
    asrPromise = pipeline(
      "automatic-speech-recognition",
      "onnx-community/whisper-base",
      {
        dtype: "q8",
        device: (navigator as Navigator & { gpu?: unknown }).gpu
          ? ("webgpu" as const)
          : ("wasm" as const),
        progress_callback: (p: { status?: string; progress?: number; file?: string }) => {
          if (p?.status === "progress" && p.file?.endsWith(".onnx")) {
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

self.onmessage = async (e: MessageEvent) => {
  const { audio, language } = e.data as { audio: Float32Array; language?: string };
  try {
    self.postMessage({ loading: true, note: "Loading voice model…" });
    const pipe = await getAsr();
    const out = await pipe(audio, {
      task: "transcribe",
      language: language ?? null,
      return_timestamps: false,
    });
    self.postMessage({ ok: true, text: (out.text ?? "").trim() });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};
