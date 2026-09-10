/** Gemini Nano (Chrome built-in Prompt API) engine — Tier 0 fast path. */
import type { AssistantEngine, ChatTurn, EngineEvents } from "./assistant-engine";
import { buildSystemPrompt } from "./assistant-context";

interface NanoPromptPart {
  role: "system" | "user" | "assistant";
  content: string;
}

interface NanoSession {
  promptStreaming(input: string | NanoPromptPart[]): ReadableStream<string>;
  destroy(): void;
  clone(signal?: { signal?: AbortSignal }): Promise<NanoSession>;
}

interface NanoLanguageModel {
  availability(): Promise<string>;
  create(opts?: Record<string, unknown>): Promise<NanoSession>;
}

function getLM(): NanoLanguageModel | null {
  const w = window as typeof window & { LanguageModel?: NanoLanguageModel };
  return w.LanguageModel ?? null;
}

export class NanoEngine implements AssistantEngine {
  readonly kind = "nano" as const;
  private session: NanoSession | null = null;
  private history: NanoPromptPart[] = [];

  async init(): Promise<void> {
    const LM = getLM();
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

    // Map prior conversation into the running session history.
    const prior = history.slice(0, -1).slice(-6);
    for (const turn of prior) {
      this.history.push({ role: turn.role, content: turn.content });
    }
    const input: NanoPromptPart[] = [...this.history, { role: "user", content: last.content }];
    this.history = [];

    const stream = this.session.promptStreaming(input);
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
