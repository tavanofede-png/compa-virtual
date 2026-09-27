"use client";

import { companionVoiceProfile, type CharacterId } from "@compa/domain";
import { useCallback, useEffect, useRef, useState } from "react";

type RecognitionResultEvent = {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};
type RecognitionErrorEvent = { error: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type ListenTurnHandlers = {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onEnd?: (delivered: boolean) => void;
  onError?: (code: string) => void;
};

function recognitionConstructor() {
  if (typeof window === "undefined") return undefined;
  const value = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return value.SpeechRecognition ?? value.webkitSpeechRecognition;
}

export function useCompanionVoice(characterId?: CharacterId) {
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [enabled, setEnabledState] = useState(true);
  const [error, setError] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const profile = companionVoiceProfile(characterId);
  const recognitionSupported = !!recognitionConstructor();

  useEffect(() => {
    const saved = window.localStorage.getItem("kusiy:companion-voice");
    if (saved !== null) setEnabledState(saved === "1");
    return () => {
      recognition.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    window.localStorage.setItem("kusiy:companion-voice", value ? "1" : "0");
    if (!value) {
      window.speechSynthesis?.cancel();
      setSpeaking(false);
    }
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    recognition.current?.stop();
    setSpeaking(false);
    setListening(false);
  }, []);

  const speak = useCallback(
    (text: string, force = false, onDone?: () => void) => {
      if (
        (!enabled && !force) ||
        !text.trim() ||
        !("speechSynthesis" in window)
      )
        return false;
      const synthesis = window.speechSynthesis;
      synthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = synthesis
        .getVoices()
        .filter((voice) => voice.lang.toLowerCase().startsWith("es"))
        .sort(
          (a, b) =>
            Number(b.localService) - Number(a.localService) ||
            a.name.localeCompare(b.name),
        );
      const voice = voices[profile.voiceOffset % Math.max(voices.length, 1)];
      if (voice) {
        utterance.voice = voice;
        setVoiceName(voice.name);
      }
      utterance.lang = voice?.lang ?? profile.language;
      utterance.rate = profile.rate;
      utterance.pitch = profile.pitch;
      utterance.onstart = () => {
        setError("");
        setSpeaking(true);
      };
      utterance.onend = () => {
        setSpeaking(false);
        onDone?.();
      };
      utterance.onerror = (event) => {
        setSpeaking(false);
        if (event.error !== "canceled" && event.error !== "interrupted")
          setError("La voz del dispositivo no pudo reproducirse.");
        if (event.error !== "canceled" && event.error !== "interrupted")
          onDone?.();
      };
      synthesis.speak(utterance);
      return true;
    },
    [enabled, profile],
  );

  const listen = useCallback(
    (onTranscript: (text: string) => void) => {
      const Constructor = recognitionConstructor();
      if (!Constructor) {
        setError("El dictado no está disponible en este navegador.");
        return;
      }
      recognition.current?.abort();
      const instance = new Constructor();
      recognition.current = instance;
      instance.lang = profile.language;
      instance.continuous = false;
      instance.interimResults = true;
      instance.onresult = (event) => {
        let transcript = "";
        for (
          let index = event.resultIndex;
          index < event.results.length;
          index++
        )
          transcript += event.results[index][0].transcript;
        onTranscript(transcript.trim());
      };
      instance.onerror = (event) => {
        setListening(false);
        if (event.error !== "aborted" && event.error !== "no-speech")
          setError("No pudimos entender el audio. Podés escribir el mensaje.");
      };
      instance.onend = () => setListening(false);
      setError("");
      setListening(true);
      instance.start();
    },
    [profile.language],
  );

  const listenTurn = useCallback(
    ({ onInterim, onFinal, onEnd, onError }: ListenTurnHandlers) => {
      const Constructor = recognitionConstructor();
      if (!Constructor) {
        setError("La llamada de voz no está disponible en este navegador.");
        onError?.("not-supported");
        return;
      }
      recognition.current?.abort();
      const instance = new Constructor();
      recognition.current = instance;
      let delivered = false;
      let finalTranscript = "";
      instance.lang = profile.language;
      instance.continuous = false;
      instance.interimResults = true;
      instance.onresult = (event) => {
        let interimTranscript = "";
        for (
          let index = event.resultIndex;
          index < event.results.length;
          index++
        ) {
          const result = event.results[index];
          const transcript = result[0].transcript.trim();
          if (!transcript) continue;
          if (result.isFinal)
            finalTranscript = `${finalTranscript} ${transcript}`.trim();
          else interimTranscript = `${interimTranscript} ${transcript}`.trim();
        }
        onInterim(`${finalTranscript} ${interimTranscript}`.trim());
        if (finalTranscript && !delivered) {
          delivered = true;
          onFinal(finalTranscript);
          instance.stop();
        }
      };
      instance.onerror = (event) => {
        setListening(false);
        onError?.(event.error);
        if (event.error !== "aborted" && event.error !== "no-speech")
          setError(
            event.error === "not-allowed" ||
              event.error === "service-not-allowed"
              ? "Necesitamos permiso para usar el micrófono durante la llamada."
              : "No pudimos entender el audio. La llamada intentará escuchar de nuevo.",
          );
      };
      instance.onend = () => {
        setListening(false);
        onEnd?.(delivered);
      };
      setError("");
      setListening(true);
      instance.start();
    },
    [profile.language],
  );

  return {
    enabled,
    setEnabled,
    speaking,
    listening,
    recognitionSupported,
    voiceName,
    error,
    speak,
    listen,
    listenTurn,
    stop,
  };
}
