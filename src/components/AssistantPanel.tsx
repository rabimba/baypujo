"use client";

import { useEffect, useRef, useState } from "react";
import { Shiuli } from "./motifs";
import { VoiceIO } from "../lib/voice-io";
import type { ChatTurn } from "../lib/assistant-engine";
import type { EngineStatus } from "../lib/engine-manager";
import { isOnTopic, OFF_TOPIC_REPLY } from "../lib/assistant-context";

type Phase = "warming" | "ready" | "thinking" | "transcribing" | "listening" | "error";

const MODEL_DOWNLOAD_NOTE =
  "First use downloads the on-device model (~1.2 GB over Wi-Fi, cached by your browser after that). Nothing is ever sent to a server.";

export default function AssistantPanel({
  onClose,
}: {
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("warming");
  const [status, setStatus] = useState<EngineStatus>({
    choice: null,
    state: "probing",
    note: "Checking what this device can run…",
  });
  const [err, setErr] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [streamText, setStreamText] = useState("");
  const [voiceCapable, setVoiceCapable] = useState(true);
  const [listening, setListening] = useState(false);
  const [micNote, setMicNote] = useState<string | null>(null);
  const [level, setLevel] = useState(0);

  const managerRef = useRef<import("../lib/engine-manager").EngineManager | null>(null);
  /** Always-fresh busy flag — async continuations (voice path) must not
   *  act on a stale closure snapshot that still says listening/thinking. */
  const busyRef = useRef(false);
  /** Mic state for callbacks that outlive their render — the speech-end
   *  auto-stop fires from an audio callback captured at mic-open time,
   *  when `listening` was still false. Reading state there restarted the
   *  recording instead of ending it. */
  const listeningRef = useRef(false);
  /** Latest stopMic, so the auto-stop callback runs the current one. */
  const stopMicRef = useRef<(() => Promise<void>) | null>(null);
  /** Latest turns, for history built inside async continuations. */
  const turnsRef = useRef<ChatTurn[]>([]);
  const voiceRef = useRef<VoiceIO | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  const busy = phase === "thinking" || phase === "transcribing" || listening;
  // The voice path legitimately transitions listening→transcribing→send
  // inside one async closure; when that closure calls send, phase is
  // "transcribing" (busy) — but the send IS the continuation of that very
  // turn. Allow it: mark the handoff.
  const sendingFromVoice = useRef(false);

  // Boot: dynamic-import manager + voice, start background warm-up.
  useEffect(() => {
    let dead = false;
    void (async () => {
      const { EngineManager } = await import("../lib/engine-manager");
      if (dead) return;
      const mgr = new EngineManager();
      managerRef.current = mgr;
      try {
        await mgr.warm((s) => {
          if (!dead) {
            setStatus(s);
            setPhase((p) => (p === "warming" && s.state === "ready" ? "ready" : p));
            if (s.state === "failed") {
              setPhase("error");
              setErr(s.note);
            }
          }
        });
      } catch {
        /* status callbacks already surfaced the failure */
      }
      if (dead) return;
      const canVoice = await VoiceIO.capable();
      if (dead) return;
      setVoiceCapable(canVoice);
      // Pre-warm whisper in the background so the first voice question
      // doesn't wait on a 45MB download after the user speaks.
      if (canVoice) {
        import("../lib/voice-io").then(({ VoiceIO }) => {
          if (dead) return;
          if (!voiceRef.current) voiceRef.current = new VoiceIO();
          // Only surface prewarm progress when the mic is idle — a live
          // recording/transcription owns the note line.
          voiceRef.current.prewarm((note) => {
            if (!dead && !busyRef.current) setMicNote(note);
          });
        });
      }
      if (!dead && managerRef.current?.getStatus().state === "ready") {
        setPhase((p) => (p === "warming" ? "ready" : p));
      }
    })();
    return () => {
      dead = true;
      managerRef.current?.destroy();
      managerRef.current = null;
      voiceRef.current?.dispose();
      voiceRef.current = null;
    };
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [turns, streamText, micNote]);

  useEffect(() => {
    busyRef.current = busy;
    listeningRef.current = listening;
  }, [busy, listening]);

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q) return;
    if (busyRef.current && !sendingFromVoice.current) return;
    setInput("");
    setMicNote(null);
    // Deterministic topic gate — refuses off-site questions locally,
    // before any model tokens are spent (small models can't be trusted
    // to hold the fence on their own).
    if (
      /^\([^)]{0,40}\)$/.test(q) || // "(dog barking)" audio descriptions
      /^\[?blank_audio\]?$/i.test(q) ||
      /^\[?silence\]?$/i.test(q) ||
      q.replace(/[^a-z]/gi, "").length < 2 // "you", "…", single letters
    ) {
      // Whisper non-speech artifacts — never waste a model call on these.
      // The raw token ("[BLANK_AUDIO]") is engineer-speak, so it is not
      // echoed as a user turn.
      setTurns((h) => [
        ...h,
        {
          role: "assistant",
          content:
            "I couldn't quite hear that — tap 🎤 and speak a bit louder, closer to the mic.",
        },
      ]);
      setPhase("ready");
      return;
    }
    if (!isOnTopic(q)) {
      setTurns((h) => [
        ...h,
        { role: "user", content: q },
        { role: "assistant", content: OFF_TOPIC_REPLY },
      ]);
      voiceRef.current?.speak(OFF_TOPIC_REPLY);
      // Without this the voice path stays on "transcribing" forever and
      // the mic button never unlocks.
      setPhase("ready");
      return;
    }
    const history: ChatTurn[] = [...turnsRef.current, { role: "user", content: q }];
    setTurns(history);
    setStreamText("");
    setPhase("thinking");
    try {
      const mgr = managerRef.current;
      if (!mgr) throw new Error("Engine not ready yet");
      let full = "";
      const { answer } = await mgr.ask(
        history.slice(-8),
        {
          onToken: (t) => {
            full += t;
            setStreamText(full);
          },
        },
        (s) => {
          setStatus(s);
          if (s.state === "downloading") setPhase("warming");
        },
      );
      const final = (answer || full).trim() || "…";
      setTurns((h) => [...h, { role: "assistant", content: final }]);
      setStreamText("");
      setPhase("ready");
      if (voiceRef.current) {
        voiceRef.current.speak(final);
      }
    } catch (e) {
      setStreamText("");
      setPhase("error");
      setErr(String((e as Error)?.message ?? e));
    }
  };

  const startMic = async () => {
    if (!voiceRef.current) voiceRef.current = new VoiceIO();
    try {
      setMicNote("Listening — ask your question, I'll stop when you finish");
      setErr(null);
      setPhase("listening");
      await voiceRef.current.startListening(
        // raw peak → visible ring; quiet mics still need to show life
        (peak) => setLevel(Math.min(1, peak * 6)),
        // Speech-end auto-stop fires from an audio callback captured
        // now; route through a ref so it runs the CURRENT stopMic
        // (a direct closure would still think listening === false and
        // start a second recording).
        () => void stopMicRef.current?.(),
      );
      setListening(true);
      listeningRef.current = true;
    } catch (e) {
      // Recover fully — a stuck phase here is what made the mic
      // un-clickable after one failed attempt.
      setListening(false);
      listeningRef.current = false;
      setLevel(0);
      setPhase("ready");
      setMicNote(null);
      const msg = String((e as Error)?.message ?? e);
      setErr(
        /permission|denied|not allowed/i.test(msg)
          ? "Microphone permission denied — allow mic access in the address bar and try again."
          : `Microphone failed: ${msg.slice(0, 120)}`,
      );
    }
  };

  const stopMic = async () => {
    // Auto-stop and a user click can race; only the first one runs.
    if (!listeningRef.current || !voiceRef.current) return;
    listeningRef.current = false;
    setListening(false);
    setLevel(0);
    setPhase("transcribing");
    setMicNote("Transcribing…");
    try {
      const res = await voiceRef.current.stopListening((note) =>
        setMicNote(note),
      );
      setMicNote(null);
      if (res.error) {
        setErr(res.error);
        setPhase("ready");
        return;
      }
      if (res.text) {
        sendingFromVoice.current = true;
        try {
          await send(res.text);
        } finally {
          sendingFromVoice.current = false;
        }
      } else {
        setErr("Nothing heard — hold the mic a bit longer and speak up.");
        setPhase("ready");
      }
    } catch (e) {
      setMicNote(null);
      setPhase("ready");
      setErr(
        `Transcription failed: ${String((e as Error)?.message ?? e).slice(0, 120)}`,
      );
    }
  };

  useEffect(() => {
    stopMicRef.current = stopMic;
  });

  const toggleMic = async () => {
    if (listeningRef.current) return stopMic();
    if (busyRef.current) {
      setMicNote("Still answering the last question — one moment…");
      return;
    }
    return startMic();
  };

  const brainLabel =
    status.choice === "nano"
      ? "Chrome built-in AI"
      : status.choice === "webllm"
        ? status.state === "failed"
          ? "model unavailable"
          : "Qwen3 · on-device"
        : status.state === "failed"
          ? "no engine available"
          : "detecting…";

  const statusLine =
    phase === "warming" || status.state === "downloading"
      ? status.note
      : null;

  return (
    <div
      className="fixed z-[60] bottom-4 right-4 w-[min(24rem,calc(100vw-2rem))] bg-shiuli border-2 border-dhunuchi/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col print:hidden"
      role="dialog"
      aria-label="Pujo assistant"
    >
      <div className="durgo-gradient text-white px-4 py-3 flex items-center gap-2">
        <Shiuli className="w-4 h-4 text-sona shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-sm leading-tight">
            কার্তিক · পুজো সহায়ক
          </p>
          <p className="text-[10px] text-white/75 font-body leading-tight truncate">
            {brainLabel} · answers stay on this device
          </p>
        </div>
        {/* Readiness indicator */}
        <span
          className={`shrink-0 w-2.5 h-2.5 rounded-full ${
            status.state === "ready"
              ? "bg-emerald-400 animate-none"
              : status.state === "downloading"
                ? "bg-sona animate-pulse"
                : status.state === "failed"
                  ? "bg-rose-400"
                  : "bg-white/60 animate-pulse"
          }`}
          title={
            status.state === "ready"
              ? "Ready to answer"
              : status.state === "downloading"
                ? "Downloading model"
                : status.state === "failed"
                  ? "Unavailable"
                  : "Checking capability"
          }
          aria-label={`Assistant status: ${status.state}`}
        />
        <button
          onClick={onClose}
          className="ml-1 text-white/80 hover:text-white text-lg leading-none px-1"
          aria-label="Close assistant"
        >
          ×
        </button>
      </div>

      {statusLine && (
        <div className="px-4 py-2 bg-kash/70 text-[11px] font-body text-ink/80 border-b border-dhunuchi/30">
          {statusLine}
        </div>
      )}

      {micNote && (
        <div className="px-4 py-1.5 bg-sona/25 text-[11px] font-body text-ink/80 border-b border-dhunuchi/20">
          🎤 {micNote}
        </div>
      )}

      <div
        ref={logRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 max-h-[46vh] min-h-[9rem] font-body text-sm"
      >
        {turns.length === 0 && streamText === "" && phase !== "error" && (
          <div className="text-stone-500 text-[13px] space-y-2">
            <p className="font-display font-semibold text-sindoor-dark text-sm">
              {status.state === "ready"
                ? "Ask me anything about this year's pujas:"
                : "Warming up — you can type your question meanwhile:"}
            </p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Which pujas are on Ashtami weekend?</li>
              <li>অষ্টমীতে কোথায় পুজো হবে? (বাংলায় জিজ্ঞাসা করুন)</li>
              <li>Free pujas near San Ramon?</li>
              <li>When is Mahalaya?</li>
            </ul>
            <p className="text-[11px] text-stone-400 pt-1">
              {MODEL_DOWNLOAD_NOTE}
            </p>
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
            <button
              className="block mt-1 underline text-rose-700"
              onClick={() => {
                setErr(null);
                setPhase("ready");
              }}
            >
              dismiss
            </button>
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
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send(input);
          }}
          placeholder={
            listening
              ? "Listening…"
              : busy
                ? "Thinking…"
                : "Ask about pujas…"
          }
          disabled={listening}
          className="flex-1 min-w-0 bg-white border border-stone-200 rounded-full px-4 py-2 text-sm font-body focus:outline-none focus:border-dhunuchi disabled:opacity-60"
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
