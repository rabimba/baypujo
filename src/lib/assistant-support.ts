/** Assistant capability detection + engine-tier routing. Client-side only. */

export type AssistantSupport = {
  /** Floating button should be shown at all. */
  supported: boolean;
  /** Gemini Nano (Chrome built-in) usable right now. */
  nano: boolean;
  /** WebGPU strong enough for the WebLLM model. */
  webllm: boolean;
};

// Qwen3-1.7B: full attention (no gemma3 SWA trap), genuinely multilingual
// incl. Bengali (119 languages) — the 0.6B produces broken Bengali.
// 2.0 GB q4f16, low-resource tier. Thinking blocks are stripped in stream.
export const WEBLLM_MODEL_ID = "Qwen3-1.7B-q4f16_1-MLC";

/** Cheap sync check — hides the button before anything loads. */
export function quickSupport(): boolean {
  if (typeof navigator === "undefined") return false;
  const w = window as typeof window & { LanguageModel?: unknown };
  const nav = navigator as Navigator & { gpu?: unknown };
  return typeof nav.gpu !== "undefined" || typeof w.LanguageModel !== "undefined";
}

interface WebGpuAdapterInfo {
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
  maxStorageBufferBindingSize?: number;
  isFallbackAdapter?: boolean;
}

async function webgpuCapable(): Promise<boolean> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<WebGpuAdapterInfo | null> } }).gpu;
    if (!gpu) return false;
    const adapter = await gpu.requestAdapter();
    if (!adapter) return false;
    // Software/fallback adapters (old Surface et al) can't run a 2GB LLM sanely.
    if (adapter.isFallbackAdapter) return false;
    // Storage-buffer limit: 0/undefined = not reported (many Mac adapters) —
    // treat as unknown and let WebLLM decide at load time. Only an explicitly
    // small positive limit (< 128 MB) disqualifies.
    const limit = adapter.maxStorageBufferBindingSize;
    if (typeof limit === "number" && limit > 0 && limit < 128 * 1024 * 1024) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function nanoAvailable(): Promise<boolean> {
  try {
    const LM = (window as typeof window & { LanguageModel?: typeof LanguageModel })
      .LanguageModel;
    if (!LM) return false;
    const av = await LM.availability();
    // "downloadable" means a big first-download we won't auto-trigger;
    // use Nano only when Chrome already has it ("readily"/"available").
    return (av as string) === "available" || (av as string) === "readily";
  } catch {
    return false;
  }
}

export async function detectSupport(): Promise<AssistantSupport> {
  const [webllm, nano] = await Promise.all([webgpuCapable(), nanoAvailable()]);
  return { supported: webllm || nano, nano, webllm };
}

/** Which engine should answer this query? */
export function pickEngine(
  support: AssistantSupport,
  query: string,
): "nano" | "webllm" {
  // Bengali always goes to the WebLLM model — Nano's language list has no Bengali.
  if (/[\u0980-\u09FF]/.test(query)) return "webllm";
  if (support.nano) return "nano";
  return "webllm";
}
