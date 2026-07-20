import { useCallback, useEffect, useRef, useState } from "react";

// ─── Lettura ad alta voce (TTS) ───────────────────────────────────────────────
// Usa speechSynthesis del browser: zero backend, zero costi, funziona offline.
// Un solo messaggio alla volta parla: il player e' condiviso da tutta la pagina.

// Il markdown letto ad alta voce suona malissimo: via i simboli, resta il testo.
function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " . blocco di codice . ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__|\*|_|~~)/g, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\|/g, " ")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

export type SpeechState = {
  speakingId: number | null;
  paused: boolean;
  supported: boolean;
  speak: (id: number, text: string) => void;
  toggle: () => void;
  stop: () => void;
};

export function useSpeech(): SpeechState {
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    utterRef.current = null;
    setSpeakingId(null);
    setPaused(false);
  }, [supported]);

  const speak = useCallback((id: number, text: string) => {
    if (!supported) return;
    // Ri-toccare il messaggio che sta parlando = stop (comportamento da player).
    if (speakingId === id) { stop(); return; }
    window.speechSynthesis.cancel();
    const clean = stripMarkdown(text);
    if (!clean) return;
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = "it-IT";
    u.rate = 1.02;
    const itVoice = window.speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith("it"));
    if (itVoice) u.voice = itVoice;
    u.onend = () => { setSpeakingId(null); setPaused(false); utterRef.current = null; };
    u.onerror = () => { setSpeakingId(null); setPaused(false); utterRef.current = null; };
    utterRef.current = u;
    setPaused(false);
    setSpeakingId(id);
    window.speechSynthesis.speak(u);
  }, [supported, speakingId, stop]);

  const toggle = useCallback(() => {
    if (!supported || speakingId == null) return;
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  }, [supported, speakingId]);

  // Cambiare pagina mentre parla lascerebbe la voce accesa a vuoto.
  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);

  return { speakingId, paused, supported, speak, toggle, stop };
}

// ─── Registrazione note vocali ────────────────────────────────────────────────
// MediaRecorder per l'audio + SpeechRecognition (dove c'e') per la trascrizione:
// l'agente non puo' ascoltare l'audio, quindi il testo dettato e' cio' che legge.

type SpeechRecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
};

function getRecognition(): SpeechRecognitionLike | null {
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  try { return new Ctor() as SpeechRecognitionLike; } catch { return null; }
}

export type VoiceRecorder = {
  recording: boolean;
  seconds: number;
  transcript: string;
  supported: boolean;
  start: () => Promise<void>;
  stop: () => Promise<{ blob: Blob; transcript: string } | null>;
  cancel: () => void;
};

export function useVoiceRecorder(): VoiceRecorder {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const srRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");

  const supported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  const cleanup = useCallback(() => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try { srRef.current?.stop(); } catch {}
    srRef.current = null;
    setRecording(false);
  }, []);

  const start = useCallback(async () => {
    if (!supported) throw new Error("Questo browser non espone il microfono (serve HTTPS e un browser recente).");

    // Se un tentativo precedente ha lasciato lo stream aperto, il microfono
    // risulta "occupato" (NotReadableError) e non si riapre piu' fino al reload:
    // qui si rilascia sempre tutto prima di richiederlo.
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e: any) {
      const name = e?.name || "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        throw new Error("Permesso microfono negato. Tocca il lucchetto accanto all'indirizzo → Autorizzazioni → Microfono → Consenti.");
      }
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        throw new Error("Nessun microfono trovato su questo dispositivo.");
      }
      if (name === "NotReadableError" || name === "AbortError") {
        throw new Error("Microfono occupato da un'altra app (o da un'altra scheda). Chiudila e riprova.");
      }
      throw new Error(`Microfono non disponibile (${name || "errore sconosciuto"}).`);
    }

    streamRef.current = stream;
    chunksRef.current = [];
    finalRef.current = "";
    setTranscript("");
    setSeconds(0);

    // Da qui in poi, se qualcosa fallisce va rilasciato lo stream: senza questo
    // il microfono resta bloccato e ogni tentativo successivo fallisce.
    try {
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.start();
      recRef.current = mr;
    } catch (e: any) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      throw new Error(`Registrazione non avviabile (${e?.name || "errore"}).`);
    }

    setRecording(true);
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);

    // La trascrizione e' un extra e parte DOPO che l'audio sta gia' registrando:
    // su Android il riconoscimento vocale litiga col microfono, quindi se fallisce
    // deve restare comunque il vocale. Mai far cadere la registrazione per questo.
    const sr = getRecognition();
    if (sr) {
      sr.lang = "it-IT";
      sr.continuous = true;
      sr.interimResults = true;
      sr.onresult = (e: any) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const chunk = e.results[i][0]?.transcript ?? "";
          if (e.results[i].isFinal) finalRef.current += chunk + " ";
          else interim += chunk;
        }
        setTranscript((finalRef.current + interim).trim());
      };
      sr.onerror = (ev: any) => {
        // "not-allowed"/"service-not-allowed": niente trascrizione, l'audio resta.
        console.warn("[voce] riconoscimento non disponibile:", ev?.error);
        srRef.current = null;
      };
      try { sr.start(); srRef.current = sr; } catch (e) {
        console.warn("[voce] riconoscimento non avviato:", e);
        srRef.current = null;
      }
    }
  }, [supported]);

  const stop = useCallback(async (): Promise<{ blob: Blob; transcript: string } | null> => {
    const mr = recRef.current;
    if (!mr) { cleanup(); return null; }
    const done = new Promise<Blob>((resolve) => {
      mr.onstop = () => resolve(new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" }));
    });
    try { mr.stop(); } catch {}
    const blob = await done;
    // Un attimo per l'ultimo risultato del riconoscimento vocale.
    await new Promise((r) => setTimeout(r, 250));
    const text = (finalRef.current || transcript).trim();
    cleanup();
    recRef.current = null;
    return { blob, transcript: text };
  }, [cleanup, transcript]);

  const cancel = useCallback(() => {
    try { recRef.current?.stop(); } catch {}
    recRef.current = null;
    chunksRef.current = [];
    setTranscript("");
    setSeconds(0);
    cleanup();
  }, [cleanup]);

  useEffect(() => cleanup, [cleanup]);

  return { recording, seconds, transcript, supported, start, stop, cancel };
}
