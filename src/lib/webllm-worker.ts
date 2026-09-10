"use strict";
/* WebLLM engine worker — gemma3-1b-it q4f16 via WebGPU, off the main thread. */
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};
