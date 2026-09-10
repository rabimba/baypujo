/** WebLLM engine (gemma3-1b-it q4f16, WebGPU, dedicated worker). */
import type { AssistantEngine, ChatTurn, EngineEvents } from "./assistant-engine";
import { buildSystemPrompt } from "./assistant-context";
import { WEBLLM_MODEL_ID } from "./assistant-support";

interface WebLlmChatCompletions {
  create(opts: {
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
    messages: { role: "system" | "user" | "assistant"; content: string }[];
  }): Promise<AsyncIterable<{ choices: ({ delta?: { content?: string } })[] }>>;
}

interface WebLlmEngineInstance {
  reload(modelId: string, engineConfig?: Record<string, unknown>): Promise<void>;
  chat: { completions: WebLlmChatCompletions };
  unload(): Promise<void>;
}

interface WebLlmModule {
  CreateWebWorkerMLCEngine(
    worker: Worker,
    modelId: string,
    engineConfig: {
      appConfig?: Record<string, unknown>;
      initProgressCallback?: (r: { progress?: number; text?: string }) => void;
    },
  ): Promise<WebLlmEngineInstance>;
}

export class WebLlmEngine implements AssistantEngine {
  readonly kind = "webllm" as const;
  private engine: WebLlmEngineInstance | null = null;
  private worker: Worker | null = null;

  async init(events: EngineEvents): Promise<void> {
    const webllm = (await import("@mlc-ai/web-llm")) as unknown as WebLlmModule;
    this.worker = new Worker(new URL("./webllm-worker.ts", import.meta.url), {
      type: "module",
    });
    this.engine = await webllm.CreateWebWorkerMLCEngine(
      this.worker,
      WEBLLM_MODEL_ID,
      {
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
      max_tokens: 256,
      messages,
    });
    let out = "";
    for await (const chunk of chunks) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        out += delta;
        events.onToken?.(delta);
      }
    }
    return out;
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
