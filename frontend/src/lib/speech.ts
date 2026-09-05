/** Voice recognition hook (Web Speech API) — powers voice shopping. */
import { useEffect, useRef, useState } from 'react';

export function useSpeech(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported] = useState<boolean>(
    () => typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  );
  const recRef = useRef<any>(null);
  const cbRef = useRef(onResult);
  cbRef.current = onResult;

  const stop = () => {
    try { recRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
  };

  const start = () => {
    if (!supported) return;
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new Ctor();
    rec.lang = 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const text = String(e.results?.[0]?.[0]?.transcript || '').trim();
      setListening(false);
      if (text) cbRef.current(text);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  };

  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* noop */ } }, []);

  return { listening, supported, start, stop, toggle: () => (listening ? stop() : start()) };
}
