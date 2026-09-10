"use client";

import { useEffect, useRef, useState } from "react";
import { Shiuli } from "./motifs";
import { VoiceIO } from "../lib/voice-io";
import { city } from "../lib/pujas";
import type { AssistantEngine, ChatTurn } from "../lib/assistant-engine";

type Phase =
  | "idle"
  | "probe"
  | "init"
  | "ready"
  | "thinking"
  | "listening"
  | "error";

type Brain = "nano" | "webllm" | null;

const MODEL_DOWNLOAD_NOTE =
  "First use downloads the on-device model (~700 MB for the LLM, ~45 MB for voice) over Wi-Fi. It is cached by your browser after that — nothing is ever sent to a server.";

export default function AssistantPanel({
  onClose,
}: {
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("probe");
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [brain, setBrain] = useState<Brain>(null);
  const [voiceCapable, setVoiceCapable] = useState(false);
  const [listening, setListening] = useState(false);
  const [level, setLevel] = useState(0);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [streamText, setStreamText] = useState("");

  const engineRef = useRef<AssistantEngine | null>(null);
  const voiceRef = useRef<VoiceIO | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const busy = phase === "thinking" || phase === "listening";

  useEffect(() => {
    let dead = false;

    const boot = async () => {
      const { detectSupport } = await import("../lib/assistant-support");
      const support = await detectSupport();
      if (dead) return;
      if (!support.supported) {
        setPhase("error");
        setErr("This device can't run the on-device assistant.");
        return;
      }
      setVoiceCapable(await VoiceIO.capable());
      setPhase("idle");
    };
    void boot();

    return () => {
      dead = true;
      engineRef.current?.destroy();
      engineRef.current = null;
      voiceRef.current?.dispose();
      voiceRef.current = null;
    };
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [turns, streamText]);

  const ensureEngine = async (
    query: string,
  ): Promise<AssistantEngine> => {
    const { pickEngine } = await import("../lib/assistant-support");
    const which = pickEngine(
      { supported: true, nano: !!(window as { LanguageModel?: unknown }).LanguageModel, webllm: true },
      query,
    );
    if (engineRef.current && engineRef.current.kind === which) {
      return engineRef.current;
    }
    engineRef.current?.destroy();
    const impl =
      which === "nano"
        ? new (await import("../lib/nano-engine")).NanoEngine()
        : new (await import("../lib/webllm-engine")).WebLlmEngine();
    setPhase("init");
    setBrain(which);
    await impl.init({
      onProgress: (p, text) => {
        const pct = Math.round((p ?? 0) * 100);
        setProgress(text?.includes("Loading") ? `${pct}%` : text);
      },
    });
    engineRef.current = impl;
    setPhase("ready");
    setProgress(null);
    return impl;
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    const history: ChatTurn[] = [...turns, { role: "user", content: q }];
    setTurns(history);
    setStreamText("");
    setPhase("thinking");
    try {
      const engine = await ensureEngine(q);
      let full = "";
      await engine.ask(history.slice(-8), {
        onToken: (t) => {
          full += t;
          setStreamText(full);
        },
      });
      const answer = full.trim() || "…";
      setTurns((h) => [...h, { role: "assistant", content: answer }]);
      setStreamText("");
      setPhase("ready");
      if (voiceRef.current) {
        voiceRef.current.speak(answer);
      }
    } catch (e) {
      setPhase("error");
      setErr(String((e as Error)?.message ?? e));
    }
  };

  const toggleMic = async () => {
    if (busy && !listening) return;
    if (!voiceRef.current) voiceRef.current = new VoiceIO();
    if (!listening) {
      try {
        setPhase("listening");
        await voiceRef.current.startListening((peak) =>
          setLevel(Math.min(1, peak * 3)),
        );
        setListening(true);
      } catch {
        setPhase("error");
        setErr("Microphone permission denied.");
      }
    } else {
      setListening(false);
      setLevel(0);
      const { text } = await voiceRef.current.stopListening();
      setPhase("ready");
      if (text) {
        await send(text);
      }
    }
  };

  const brainLabel =
    brain === "nano" ? "Chrome built-in" : brain === "webllm" ? "gemma3 on-device" : null;

  return (
    <div
      className="fixed z-[60] bottom-4 right-4 w-[min(24rem,calc(100vw-2rem))] bg-shiuli border-2 border-dhunuchi/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col print:hidden"
      role="dialog"
      aria-label="Pujo assistant"
    >
      <div className="durgo-gradient text-white px-4 py-3 flex items-center gap-2">
        <Shiuli className="w-4 h-4 text-sona shrink-0" />
        <div className="min-w-0">
          <p className="font-display font-bold text-sm leading-tight">
            পুজো সহায়ক · {city.brand}
          </p>
          <p className="text-[10px] text-white/75 font-body leading-tight">
            {phase === "init" || phase === "probe"
              ? "Preparing on-device AI…"
              : brainLabel
                ? `${brainLabel} · answers stay on this device`
                : "Runs fully on this device"}
          </p>
        </div>
        <button
          onClick={onClose}
          className="ml-auto text-white/80 hover:text-white text-lg leading-none px-1"
          aria-label="Close assistant"
        >
          ×
        </button>
      </div>

      {(progress || (phase !== "idle" && phase !== "ready" && phase !== "listening" && phase !== "thinking" && phase !== "error")) && null}

      {phase === "init" && progress && (
        <div className="px-4 py-2 bg-kash/70 text-[11px] font-body text-ink/80 border-b border-dhunuchi/30">
          Downloading model for offline use — {progress}
          <div className="mt-1 h-1.5 bg-white/70 rounded-full overflow-hidden">
            <div
              className="h-full bg-sindoor transition-all"
              style={{ width: progress }}
            />
          </div>
        </div>
      )}

      <div
        ref={logRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 max-h-[46vh] min-h-[9rem] font-body text-sm"
      >
        {turns.length === 0 && streamText === "" && phase !== "error" && (
          <div className="text-stone-500 text-[13px] space-y-2">
            <p className="font-display font-semibold text-sindoor-dark text-sm">
              Ask me anything about this year&apos;s pujas:
            </p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Which pujas are on Ashtami weekend?</li>
              <li>অষ্টমীতে কোথায় পুজো হবে? (বাংলায় জিজ্ঞাসা করুন)</li>
              <li>Free pujas near San Ramon?</li>
              <li>When is Mahalaya?</li>
            </ul>
            <p className="text-[11px] text-stone-400 pt-1">{MODEL_DOWNLOAD_NOTE}</p>
          </div>
        )}
        {turns.map((t, i) => (
          <div
            key={i}
            className={
              t.role === "user"
                ? "ml-8 bg-sindoor/10 border border-sindoor/25 rounded-2xl rounded-br-md px-3 py-2"
                : "mr-8 bg-white border border-stone-200 rounded-2xl rounded-bl-md px-3 py-2"
            }
          >
            {t.content}
          </div>
        ))}
        {streamText && (
          <div className="mr-8 bg-white border border-stone-200 rounded-2xl rounded-bl-md px-3 py-2">
            {streamText}
            <span className="animate-pulse">▍</span>
          </div>
        )}
        {phase === "error" && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl px-3 py-2 text-[13px]">
            {err ?? "Something went wrong."}
          </div>
        )}
      </div>

      <div className="border-t border-dhunuchi/30 p-3 bg-white/60 flex items-center gap-2">
        <button
          onClick={toggleMic}
          disabled={!voiceCapable || (busy && !listening)}
          className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            listening
              ? "bg-sindoor text-white"
              : "bg-kash text-ink hover:bg-dhunuchi/40"
          } ${!voiceCapable ? "opacity-40" : ""}`}
          aria-label={listening ? "Stop recording" : "Speak your question"}
          style={
            listening
              ? {
                  boxShadow: `0 0 0 ${(level * 14).toFixed(0)}px rgba(179,35,31,.2)`,
                }
              : undefined
          }
        >
          🎤
        </button>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send(input);
          }}
          placeholder={listening ? "Listening…" : "Ask about pujas…"}
          disabled={busy}
          className="flex-1 min-w-0 bg-white border border-stone-200 rounded-full px-4 py-2 text-sm font-body focus:outline-none focus:border-dhunuchi disabled:opacity-50"
        />
        <button
          onClick={() => void send(input)}
          disabled={!input.trim() || busy}
          className="shrink-0 bg-sindoor text-white rounded-full px-4 py-2 text-sm font-display font-semibold hover:bg-sindoor-dark disabled:opacity-40 transition-colors"
        >
          Ask
        </button>
      </div>
    </div>
  );
}
