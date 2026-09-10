/** Engine lifecycle: capability-based auto-selection + background preload.
 *
 * Flow when the panel opens:
 *  1. Probe: Nano really available (downloaded) → use it (instant, no download).
 *  2. Else WebGPU → WebLLM gemma3-1b, start downloading in background
 *     with progress; the panel shows a "warming up" indicator meanwhile.
 *  3. Per-query override: Bengali script always goes to gemma3.
 *  4. Fallback: if the selected engine dies mid-conversation, swap to the
 *     other one transparently.
 */

import type { AssistantEngine, ChatTurn, EngineEvents } from "./assistant-engine";
import { buildSystemPrompt } from "./assistant-context";
import { WEBLLM_MODEL_ID } from "./assistant-support";

export type EngineChoice = "nano" | "webllm";

export interface EngineStatus {
  /** Engine chosen by capability probe. */
  choice: EngineChoice | null;
  /** Warm-up state of the chosen engine. */
  state: "probing" | "downloading" | "ready" | "failed";
  /** Human-facing note (progress %, errors). */
  note: string;
}

interface WebLlmChatCompletions {
  create(opts: {
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
    // Qwen3: suppress <think> blocks. No-op for other models.
    enable_thinking?: boolean;
    messages: { role: "system" | "user" | "assistant"; content: string }[];
  }): Promise<AsyncIterable<{ choices: ({ delta?: { content?: string } })[] }>>;
}

interface WebLlmEngineInstance {
  reload(
    modelId: string,
    engineConfig?: Record<string, unknown>,
  ): Promise<void>;
  chat: { completions: WebLlmChatCompletions };
  unload(): Promise<void>;
}

interface WebLlmChatOpts {
  context_window_size?: number;
  sliding_window_size?: number;
}

interface WebLlmAppConfig {
  model_list: unknown[];
  cacheBackend?: string;
}

interface WebLlmModule {
  CreateWebWorkerMLCEngine(
    worker: Worker,
    modelId: string,
    engineConfig: {
      appConfig?: WebLlmAppConfig;
      initProgressCallback?: (r: { progress?: number; text?: string }) => void;
    },
  ): Promise<WebLlmEngineInstance>;
  prebuiltAppConfig: WebLlmAppConfig;
}

interface NanoPromptPart {
  role: "system" | "user" | "assistant";
  content: string;
}

interface NanoSession {
  promptStreaming(
    input: string | NanoPromptPart[],
  ): ReadableStream<string>;
  destroy(): void;
}

interface NanoLanguageModelCtor {
  availability(): Promise<string>;
  create(opts?: Record<string, unknown>): Promise<NanoSession>;
}

function getNanoCtor(): NanoLanguageModelCtor | null {
  const w = window as typeof window & { LanguageModel?: NanoLanguageModelCtor };
  return w.LanguageModel ?? null;
}

class NanoEngine implements AssistantEngine {
  readonly kind = "nano" as const;
  private session: NanoSession | null = null;

  async init(): Promise<void> {
    const LM = getNanoCtor();
    if (!LM) throw new Error("LanguageModel unavailable");
    if ((await LM.availability()) !== "available") {
      throw new Error("Gemini Nano not downloaded");
    }
    this.session = await LM.create({
      initialPrompts: [
        { role: "system", content: buildSystemPrompt() },
      ] as NanoPromptPart[],
      expectedInputs: [{ type: "text", languages: ["en"] }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
    });
  }

  async ask(history: ChatTurn[], events: EngineEvents): Promise<string> {
    if (!this.session) throw new Error("NanoEngine not initialized");
    const last = history[history.length - 1];
    if (!last || last.role !== "user") throw new Error("no user turn");
    // Prompt API keeps its own conversation; send user turn directly.
    const stream = this.session.promptStreaming([
      { role: "user", content: last.content },
    ]);
    let out = "";
    const reader = stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        out += value;
        events.onToken?.(value);
      }
    }
    return out;
  }

  destroy(): void {
    try {
      this.session?.destroy();
    } catch {
      /* already gone */
    }
    this.session = null;
  }
}

/** Remove Qwen3 <think>…</think> blocks; hide an unclosed one mid-stream. */
function stripThink(raw: string): string {
  const closed = raw.replace(/<think>[\s\S]*?<\/think>/g, "");
  if (/<think>[\s\S]*$/.test(closed)) {
    // still inside an open think block — show nothing yet
    return "";
  }
  return closed.replace(/^\s+/, "");
}

class WebLlmEngine implements AssistantEngine {
  readonly kind = "webllm" as const;
  private engine: WebLlmEngineInstance | null = null;
  private worker: Worker | null = null;

  async init(events: EngineEvents): Promise<void> {
    const webllm = (await import("@mlc-ai/web-llm")) as unknown as WebLlmModule;
    this.worker = new Worker(new URL("./webllm-worker.ts", import.meta.url), {
      type: "module",
    });
    // gemma3's shipped mlc-chat-config sets sliding_window_size: 1024 (SWA).
    // Our ~3.4k-token system prompt exceeds a 1024-token sliding window, so we
    // must run the non-SWA full-attention KV cache — exactly what the prebuilt
    // record's overrides intend. Passing a context_window_size *chatOpt* on top
    // trips "only one may be positive" against the config's sliding window;
    // instead we clone the record with both fields resolved, the documented
    // ModelRecord.overrides path.
    const modelList = webllm.prebuiltAppConfig.model_list.filter(
      (m) =>
        (m as { model_id: string }).model_id === WEBLLM_MODEL_ID,
    ) as Array<Record<string, unknown>>;
    if (modelList.length === 0) {
      throw new Error(`Model ${WEBLLM_MODEL_ID} missing from prebuilt list`);
    }
    const record = {
      ...modelList[0],
      overrides: {
        ...((modelList[0].overrides as object) ?? {}),
        context_window_size: 4096,
        sliding_window_size: -1,
      },
    };
    const appConfig = {
      ...webllm.prebuiltAppConfig,
      model_list: [record],
    };
    this.engine = await webllm.CreateWebWorkerMLCEngine(
      this.worker,
      WEBLLM_MODEL_ID,
      {
        appConfig,
        initProgressCallback: (r) => {
          events.onProgress?.(r.progress ?? 0, r.text ?? "");
        },
      },
    );
  }

  async ask(history: ChatTurn[], events: EngineEvents): Promise<string> {
    if (!this.engine) throw new Error("WebLlmEngine not initialized");
    const messages = [
      { role: "system" as const, content: buildSystemPrompt() },
      ...history.slice(-8).map((t) => ({
        role: t.role,
        content: t.content,
      })),
    ];
    const chunks = await this.engine.chat.completions.create({
      stream: true,
      temperature: 0.3,
      // Qwen3 thinks before answering (enable_thinking:false is not honored
      // by web-llm 0.2.85); budget for the think block, strip it in stream.
      max_tokens: 700,
      messages,
    });
    let raw = "";
    let shown = 0; // chars of `raw` already emitted to the UI
    for await (const chunk of chunks) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (!delta) continue;
      raw += delta;
      // Visible answer = everything after the closing </think> (Qwen3).
      const cleaned = stripThink(raw);
      if (cleaned.length > shown) {
        events.onToken?.(cleaned.slice(shown));
        shown = cleaned.length;
      }
    }
    return stripThink(raw);
  }

  destroy(): void {
    try {
      void this.engine?.unload();
    } catch {
      /* noop */
    }
    this.worker?.terminate();
    this.engine = null;
    this.worker = null;
  }
}

export class EngineManager {
  private current: AssistantEngine | null = null;
  private status: EngineStatus = {
    choice: null,
    state: "probing",
    note: "Checking what this device can run…",
  };
  private readyPromise: Promise<void> | null = null;

  getStatus(): EngineStatus {
    return { ...this.status };
  }

  /** Called when the panel opens — probes and warms the best engine. */
  async warm(onStatus: (s: EngineStatus) => void): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = this.doWarm(onStatus).catch((e: unknown) => {
      const raw = e instanceof Error ? e.message : String(e);
      // Surface the real cause — device/API/download — not a generic blob.
      const note = raw.includes("fetch")
        ? "Model download failed — check your connection."
        : raw.includes("adapter") || raw.includes("WebGPU") || raw.includes("shader")
          ? `WebGPU issue: ${raw.slice(0, 140)}`
          : `Could not start the on-device model — ${raw.slice(0, 140)}`;
      this.status = {
        choice: null,
        state: "failed",
        note,
      };
      onStatus(this.status);
      // Allow retry on next warm() call.
      this.readyPromise = null;
      throw new Error(note);
    });
    return this.readyPromise;
  }

  private async doWarm(onStatus: (s: EngineStatus) => void): Promise<void> {
    const emit = (state: EngineStatus["state"], note: string) => {
      this.status = { choice: this.status.choice, state, note };
      onStatus(this.getStatus());
    };

    // 1. Nano: only when Chrome already has the model (no big download
    //    auto-triggered — that belongs to browser settings, not us).
    const LM = getNanoCtor();
    if (LM) {
      try {
        const av = await LM.availability();
        if (av === "available") {
          this.status.choice = "nano";
          emit("ready", "Chrome built-in AI");
          return;
        }
      } catch {
        /* probe failed → fall through */
      }
    }

    // 2. WebLLM gemma3 — needs WebGPU; start download in background.
    const gpuOk = await this.webgpuOk();
    if (!gpuOk) {
      this.status.choice = null;
      emit("failed", "No capable on-device model for this browser.");
      return;
    }
    this.status.choice = "webllm";
    emit(
      "downloading",
      "Downloading model (one time, ~700 MB) — cached after",
    );
    const eng = new WebLlmEngine();
    await eng.init({
      onProgress: (p, text) => {
        const pct = Math.round((p ?? 0) * 100);
        const label = /loading|cache/i.test(text ?? "")
          ? `${pct}%`
          : (text ?? `${pct}%`);
        emit(
          "downloading",
          text?.match(/Fetching|Retrieving/i)
            ? `Downloading model — ${pct}%`
            : label,
        );
      },
    });
    this.current = eng;
    emit("ready", "gemma3 on-device");
  }

  private async nanoUsable(): Promise<boolean> {
    const LM = getNanoCtor();
    if (!LM) return false;
    try {
      return (await LM.availability()) === "available";
    } catch {
      return false;
    }
  }

  private async webgpuOk(): Promise<boolean> {
    try {
      const gpu = (
        navigator as Navigator & {
          gpu?: { requestAdapter(): Promise<Record<string, unknown> | null> };
        }
      ).gpu;
      if (!gpu) return false;
      const adapter = await gpu.requestAdapter();
      if (!adapter) return false;
      const limit = adapter.maxStorageBufferBindingSize as number | undefined;
      if (limit !== undefined && limit < 128 * 1024 * 1024) return false;
      return true;
    } catch {
      return false;
    }
  }

  /** Ensure an engine for this query; transparent fallback between engines. */
  async ensureFor(
    query: string,
    onStatus: (s: EngineStatus) => void,
  ): Promise<AssistantEngine> {
    // Bengali always gemma3 (Nano has no Bengali).
    const wantBengali = /[\u0980-\u09FF]/.test(query);
    const want: EngineChoice = wantBengali
      ? "webllm"
      : (this.status.choice ?? "webllm");

    if (
      this.current &&
      this.current.kind === want &&
      this.status.state === "ready"
    ) {
      return this.current;
    }

    // Bengali while Nano was chosen: lazily warm gemma3 now.
    if (want === "webllm") {
      if (this.current?.kind !== "webllm") {
        await this.warmWebllm(onStatus);
      }
      if (!this.current || this.current.kind !== "webllm") {
        throw new Error("gemma3 unavailable for this question");
      }
      return this.current;
    }

    if (want === "nano" && this.current?.kind !== "nano") {
      const eng = new NanoEngine();
      await eng.init();
      this.current = eng;
      return eng;
    }

    if (!this.current) {
      // Nothing warmed (warm() not called or failed) — try now.
      await this.warm(onStatus);
      if (!this.current && this.status.choice !== "nano") {
        throw new Error(this.status.note);
      }
      if (this.status.choice === "nano" && !this.current) {
        const eng = new NanoEngine();
        await eng.init();
        this.current = eng;
      }
      if (!this.current) throw new Error(this.status.note);
    }
    return this.current;
  }

  private async warmWebllm(onStatus: (s: EngineStatus) => void): Promise<void> {
    const eng = new WebLlmEngine();
    this.status = { choice: "webllm", state: "downloading", note: "Downloading model…" };
    onStatus(this.getStatus());
    await eng.init({
      onProgress: (p) => {
        const pct = Math.round((p ?? 0) * 100);
        this.status = {
          choice: "webllm",
          state: "downloading",
          note: `Downloading model — ${pct}%`,
        };
        onStatus(this.getStatus());
      },
    });
    this.current?.destroy();
    this.current = eng;
    this.status = { choice: "webllm", state: "ready", note: "Qwen3 on-device" };
    onStatus(this.getStatus());
  }

  async ask(
    history: ChatTurn[],
    events: EngineEvents,
    onStatus: (s: EngineStatus) => void,
  ): Promise<{ answer: string; engine: string }> {
    const last = history[history.length - 1]?.content ?? "";
    let engine = await this.ensureFor(last, onStatus);
    try {
      const answer = await engine.ask(history, events);
      return { answer, engine: engine.kind };
    } catch (e) {
      // Engine died mid-flight → swap to the other and retry once.
      const other: EngineChoice = engine.kind === "nano" ? "webllm" : "nano";
      engine.destroy();
      this.current = null;
      if (other === "webllm") {
        await this.warmWebllm(onStatus);
        engine = this.current!;
      } else {
        const eng = new NanoEngine();
        await eng.init();
        this.current = eng;
        engine = eng;
      }
      const answer = await engine.ask(history, events);
      return { answer, engine: engine.kind };
    }
  }

  destroy(): void {
    this.current?.destroy();
    this.current = null;
    this.readyPromise = null;
    this.status = {
      choice: null,
      state: "probing",
      note: "Checking what this device can run…",
    };
  }
}
