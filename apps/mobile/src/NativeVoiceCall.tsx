import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioStream } from "expo-audio";
import * as Speech from "expo-speech";
import { companionVoiceProfile, encodeVoiceWav, monoVoiceSamples, VoicePhraseDetector, voiceCallLabels, type VoiceCallPhase, type Companion } from "@compa/domain";
import type { Repository } from "@compa/client";
import { Button, Text, styles } from "./ui";

type Props = {
  repo: Repository; characterId: Companion["character_id"];
  disabled?: boolean;
  onTurn: (text: string) => Promise<{ text: string; afterSpeech?: () => void }>;
  onActiveChange: (active: boolean) => void;
  onSpeakingChange: (speaking: boolean) => void;
  onUnsent: (text: string) => void;
};
export function NativeVoiceCall(props: Props) {
  const [phase, setPhase] = useState<VoiceCallPhase>("IDLE"), [error, setError] = useState("");
  const current = useRef(props); current.current = props;
  const mounted = useRef(true), generation = useRef(0), active = useRef(false), phaseRef = useRef<VoiceCallPhase>("IDLE");
  const detector = useRef(new VoicePhraseDetector()), lastBuffer = useRef(0), listenSince = useRef(0);
  const abort = useRef<AbortController | null>(null), finishSpeech = useRef<(() => void) | null>(null);
  const submit = useRef<(samples: Int16Array) => void>(() => {}), fail = useRef<(message: string) => void>(() => {});
  const { stream } = useAudioStream({ sampleRate: 16000, channels: 1, encoding: "int16", onBuffer: (buffer) => {
    if (!active.current || phaseRef.current !== "LISTENING") return;
    lastBuffer.current = Date.now();
    try {
      const phrase = detector.current.push(monoVoiceSamples(buffer.data, buffer.sampleRate, buffer.channels));
      if (phrase) submit.current(phrase);
    } catch (failure) { fail.current(failure instanceof Error ? failure.message : "El micrófono no está disponible."); }
  } });
  const setStatus = (status: VoiceCallPhase) => { phaseRef.current = status; if (mounted.current) setPhase(status); };
  const stopMic = () => { try { stream.stop(); } catch { /* Native resources may already be released on unmount/permission revocation. */ } };
  const isCurrent = (token: number) => mounted.current && active.current && generation.current === token && AppState.currentState === "active";
  const stop = (message = "") => {
    generation.current++; active.current = false;
    stopMic(); detector.current.reset(); abort.current?.abort(); abort.current = null;
    void Speech.stop(); finishSpeech.current?.(); finishSpeech.current = null;
    current.current.onSpeakingChange(false); current.current.onActiveChange(false);
    void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    setStatus(message ? "ERROR" : "IDLE"); if (mounted.current) setError(message);
  };
  fail.current = (message) => stop(message);
  const listen = async (token: number) => {
    if (!isCurrent(token)) return;
    const permission = await getRecordingPermissionsAsync();
    if (!isCurrent(token)) return;
    if (!permission.granted) throw Error("El permiso de micrófono se revocó. Podés continuar por texto.");
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, interruptionMode: "doNotMix",
      shouldPlayInBackground: false, allowsBackgroundRecording: false, shouldRouteThroughEarpiece: false });
    if (!isCurrent(token)) return;
    detector.current.reset(); lastBuffer.current = Date.now(); listenSince.current = Date.now();
    setStatus("LISTENING");
    await stream.start();
    // Permission dialogs and native starts may resolve after hangup/background.
    if (!isCurrent(token)) stopMic();
  };
  const speak = async (text: string, token: number) => {
    if (!text.trim() || !isCurrent(token)) return;
    await setAudioModeAsync({ allowsRecording: false, interruptionMode: "doNotMix" });
    const profile = companionVoiceProfile(current.current.characterId);
    const voices = (await Speech.getAvailableVoicesAsync()).filter((voice) => voice.language.toLowerCase().startsWith("es"))
      .sort((a, b) => Number(b.quality === "Enhanced") - Number(a.quality === "Enhanced") || a.name.localeCompare(b.name));
    const voice = voices[profile.voiceOffset % Math.max(voices.length, 1)];
    if (!isCurrent(token)) return;
    setStatus("SPEAKING");
    const max = Math.max(1, Speech.maxSpeechInputLength);
    for (let offset = 0; offset < text.length && isCurrent(token); offset += max) {
      await new Promise<void>((resolve, reject) => {
        const finish = () => { clearTimeout(timeout); resolve(); };
        const failed = () => { clearTimeout(timeout); reject(Error("La voz del dispositivo no pudo reproducirse. La respuesta quedó en el chat.")); };
        const timeout = setTimeout(failed, Math.min(180000, Math.max(20000, Math.min(max, text.length - offset) * 80 + 10000)));
        finishSpeech.current = finish;
        Speech.speak(text.slice(offset, offset + max), { language: voice?.language ?? profile.language, voice: voice?.identifier,
          rate: profile.rate, pitch: profile.pitch,
          onStart: () => { if (isCurrent(token)) current.current.onSpeakingChange(true); },
          onDone: finish, onStopped: finish, onError: failed });
      });
      finishSpeech.current = null;
    }
    current.current.onSpeakingChange(false);
  };
  submit.current = (samples) => {
    if (!active.current || phaseRef.current !== "LISTENING") return;
    const token = generation.current;
    setStatus("TRANSCRIBING"); stopMic(); detector.current.reset();
    const controller = new AbortController(); abort.current = controller;
    void (async () => {
      let transcript = "", sent = false;
      try {
        const result = await current.current.repo.transcribeVoice(encodeVoiceWav(samples), crypto.randomUUID(), controller.signal);
        abort.current = null;
        if (!isCurrent(token)) return;
        transcript = result.text.trim();
        if (transcript) {
          setStatus("THINKING");
          const answer = await current.current.onTurn(transcript); sent = true;
          if (!isCurrent(token)) return;
          await speak(answer.text, token);
          if (!isCurrent(token)) return;
          if (answer.afterSpeech) { stop(); answer.afterSpeech(); return; }
        }
        // Half duplex: release mic during inference/TTS and allow speaker tail to finish.
        await new Promise((resolve) => setTimeout(resolve, 350));
        await listen(token);
      } catch (failure) {
        if (!isCurrent(token)) return;
        if (transcript && !sent) current.current.onUnsent(transcript);
        stop(failure instanceof Error ? failure.message : "La llamada se pausó. Podés continuar por texto.");
      }
    })();
  };
  const start = async () => {
    const token = ++generation.current;
    active.current = true; current.current.onActiveChange(true); setError(""); setStatus("RECONNECTING");
    try {
      await Speech.stop(); current.current.onSpeakingChange(false);
      const availability = await current.current.repo.voiceStatus();
      if (!isCurrent(token)) return;
      if (!availability.available) throw Error(availability.reason ?? "El micrófono no está habilitado.");
      const permission = await requestRecordingPermissionsAsync();
      if (!isCurrent(token)) return;
      if (!permission.granted) throw Error("No se autorizó el micrófono. Podés continuar por texto.");
      await listen(token);
    } catch (failure) { if (isCurrent(token)) stop(failure instanceof Error ? failure.message : "No pudimos iniciar la llamada."); }
  };
  const interrupt = async () => {
    const token = ++generation.current;
    await Speech.stop(); finishSpeech.current?.(); finishSpeech.current = null;
    current.current.onSpeakingChange(false);
    setStatus("RECONNECTING");
    await new Promise((resolve) => setTimeout(resolve, 350));
    try { await listen(token); } catch (failure) { if (isCurrent(token)) stop(failure instanceof Error ? failure.message : "El micrófono no está disponible."); }
  };
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener("change", (state) => { if (state !== "active") stop(); });
    const watchdog = setInterval(() => {
      if (!active.current || phaseRef.current !== "LISTENING") return;
      if (Date.now() - lastBuffer.current > 5000) stop("El micrófono dejó de responder. Volvé a iniciar o continuá por texto.");
      else if (Date.now() - listenSince.current > 75000) stop("La llamada se pausó por inactividad. Podés iniciarla nuevamente.");
    }, 1000);
    return () => { mounted.current = false; stop(); subscription.remove(); clearInterval(watchdog); };
  }, [stream]);
  return <View style={{ backgroundColor: "#eaf0e6", padding: 18, borderRadius: 20, gap: 10 }}>
    <Text style={styles.h2}>Conversar por voz</Text>
    <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }} accessibilityLiveRegion="polite">
      {!["IDLE", "ERROR"].includes(phase) && <ActivityIndicator color="#315f55" />}
      <Text style={styles.p}>{voiceCallLabels[phase]}</Text>
    </View>
    <Text style={styles.label}>Hablá y hacé una pausa para enviar. El micrófono se apaga mientras el compañero responde.</Text>
    {!!error && <Text accessibilityRole="alert" style={styles.p}>{error}</Text>}
    {phase === "IDLE" || phase === "ERROR" ? <Button disabled={props.disabled} onPress={() => void start()}>Iniciar llamada</Button> :
      <Button onPress={() => stop()}>Colgar</Button>}
    {phase === "SPEAKING" && <Button secondary onPress={() => void interrupt()}>Interrumpir y hablar</Button>}
  </View>;
}
