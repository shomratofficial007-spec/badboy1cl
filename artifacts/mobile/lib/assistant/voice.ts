// Browser-only voice helpers built on the Web Speech API.
//
// Speech-to-text (dictation) streams audio to the browser vendor's speech
// service, so callers must gate it behind the user's voice-processing
// consent. Text-to-speech runs through the device's local voices.
// Both are unavailable outside web browsers or where the browser does not
// support the API — every helper reports that instead of throwing.

interface SpeechCallbacks {
  onTranscript: (text: string, isFinal: boolean) => void;
  onError?: () => void;
  onDone?: () => void;
  lang?: string;
}

type RecognitionInstance = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecognitionResultLike = {
  isFinal: boolean;
  0?: { transcript?: unknown };
  length: number;
};

type RecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<RecognitionResultLike>;
};

function recognitionConstructor(): (new () => RecognitionInstance) | null {
  if (typeof window === 'undefined') return null;
  const scoped = window as unknown as Record<string, unknown>;
  const ctor = scoped.SpeechRecognition ?? scoped.webkitSpeechRecognition;
  return typeof ctor === 'function'
    ? (ctor as new () => RecognitionInstance)
    : null;
}

export function isDictationAvailable(): boolean {
  return recognitionConstructor() !== null;
}

export function isReadAloudAvailable(): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  return typeof window.speechSynthesis?.speak === 'function';
}

/** Start one dictation turn. Returns a cancel function. */
export function dictateOnce(callbacks: SpeechCallbacks): () => void {
  const Ctor = recognitionConstructor();
  if (!Ctor) {
    callbacks.onError?.();
    callbacks.onDone?.();
    return () => undefined;
  }

  const recognition = new Ctor();
  recognition.lang = callbacks.lang ?? 'bn-BD';
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    callbacks.onDone?.();
  };

  recognition.onresult = (event: RecognitionEventLike) => {
    let finalText = '';
    let interimText = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const transcript =
        typeof result[0]?.transcript === 'string' ? (result[0].transcript as string) : '';
      if (result.isFinal) finalText += transcript;
      else interimText += transcript;
    }
    if (finalText || interimText) {
      callbacks.onTranscript(`${finalText}${interimText}`, finalText.length > 0 && !interimText);
    }
    if (finalText && !interimText) {
      try {
        recognition.stop();
      } catch {
        // Already stopped.
      }
      finish();
    }
  };
  recognition.onerror = () => {
    finish();
    callbacks.onError?.();
  };
  recognition.onend = () => finish();

  try {
    recognition.start();
  } catch {
    finish();
    callbacks.onError?.();
  }

  return () => {
    try {
      recognition.abort();
    } catch {
      // Already ended.
    }
    finish();
  };
}

/** Speak text through the device's local voices. No audio leaves the device. */
export function speak(text: string, lang?: string): void {
  if (!isReadAloudAvailable()) return;
  const clean = text.trim().slice(0, 4000);
  if (!clean) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  if (lang) utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
}
