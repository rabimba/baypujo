/** Unified streaming engine interface for the assistant panel. */

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface EngineEvents {
  onToken?: (t: string) => void;
  /** 0..1 model download progress (WebLLM first run only). */
  onProgress?: (p: number, text: string) => void;
}

export interface AssistantEngine {
  readonly kind: "nano" | "webllm";
  /** Warm the engine (download model if needed). Must resolve before ask(). */
  init(events: EngineEvents): Promise<void>;
  /** Streamed answer for the conversation so far. */
  ask(history: ChatTurn[], events: EngineEvents): Promise<string>;
  destroy(): void;
}
