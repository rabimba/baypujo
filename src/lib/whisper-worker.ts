"use strict";
/* Whisper-base ASR worker — Transformers.js on WebGPU (WASM fallback). */
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
      },
    ) as unknown as Promise<AsrFn>;
  }
  return asrPromise;
}

self.onmessage = async (e: MessageEvent) => {
  const { audio, language } = e.data as { audio: Float32Array; language?: string };
  try {
    const pipe = await getAsr();
    const out = await pipe(audio, {
      task: "transcribe",
      language: language ?? null,
      // gemma3 answers multilingually; let whisper auto-detect script
      return_timestamps: false,
    });
    self.postMessage({ ok: true, text: (out.text ?? "").trim() });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};
