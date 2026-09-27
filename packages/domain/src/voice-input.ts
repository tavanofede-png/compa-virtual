/** Canonical transport: mono PCM16 at 16 kHz, at most 25 seconds per phrase. */
export const VOICE_SAMPLE_RATE = 16000;
export const VOICE_MAX_SECONDS = 25;
export interface VoiceAvailability {
  available: boolean;
  reason?: string;
  remainingSeconds: number;
  resetsAt: string;
}
export type VoiceCallPhase = "IDLE" | "LISTENING" | "TRANSCRIBING" | "THINKING" | "SPEAKING" | "RECONNECTING" | "ERROR";
export const voiceCallLabels: Record<VoiceCallPhase, string> = {
  IDLE: "Llamada finalizada", LISTENING: "Te escucho…", TRANSCRIBING: "Transcribiendo…",
  THINKING: "Pensando…", SPEAKING: "Hablando…", RECONNECTING: "Reconectando…", ERROR: "La llamada se pausó",
};

export function encodeVoiceWav(samples: Int16Array): ArrayBuffer {
  if (!samples.length || samples.length > VOICE_SAMPLE_RATE * VOICE_MAX_SECONDS)
    throw Error("La intervención es demasiado larga o está vacía.");
  const buffer = new ArrayBuffer(44 + samples.length * 2), view = new DataView(buffer);
  const text = (offset: number, value: string) => [...value].forEach((letter, index) => view.setUint8(offset + index, letter.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, VOICE_SAMPLE_RATE, true); view.setUint32(28, VOICE_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => view.setInt16(44 + index * 2, sample, true));
  return buffer;
}

export function validateVoiceWav(buffer: ArrayBuffer) {
  if (buffer.byteLength < 44 + VOICE_SAMPLE_RATE / 5 * 2 || buffer.byteLength > 44 + VOICE_SAMPLE_RATE * VOICE_MAX_SECONDS * 2)
    throw Error("Usá una frase de entre 0,2 y 25 segundos.");
  const view = new DataView(buffer);
  const text = (offset: number, length: number) => String.fromCharCode(...new Uint8Array(buffer, offset, length));
  if (text(0, 4) !== "RIFF" || text(8, 4) !== "WAVE" || text(12, 4) !== "fmt " || text(36, 4) !== "data" ||
      view.getUint32(4, true) !== buffer.byteLength - 8 || view.getUint32(16, true) !== 16 ||
      view.getUint16(20, true) !== 1 || view.getUint16(22, true) !== 1 || view.getUint32(24, true) !== VOICE_SAMPLE_RATE ||
      view.getUint32(28, true) !== VOICE_SAMPLE_RATE * 2 || view.getUint16(32, true) !== 2 || view.getUint16(34, true) !== 16 ||
      view.getUint32(40, true) !== buffer.byteLength - 44 || (buffer.byteLength - 44) % 2)
    throw Error("El formato de audio no es compatible. Volvé a iniciar la llamada.");
  return { seconds: Math.ceil((buffer.byteLength - 44) / (VOICE_SAMPLE_RATE * 2)) };
}

export function monoVoiceSamples(data: ArrayBuffer, sampleRate: number, channels: number): Int16Array {
  if (![1, 2].includes(channels) || !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 96000 || data.byteLength % (channels * 2))
    throw Error("El micrófono entregó un formato incompatible.");
  const input = new DataView(data), frames = data.byteLength / (channels * 2);
  if (frames > sampleRate) throw Error("El micrófono entregó un bloque demasiado grande.");
  const output = new Int16Array(Math.floor(frames * VOICE_SAMPLE_RATE / sampleRate));
  for (let index = 0; index < output.length; index++) {
    const first = Math.min(frames - 1, Math.floor(index * sampleRate / VOICE_SAMPLE_RATE));
    const end = Math.min(frames, Math.max(first + 1, Math.floor((index + 1) * sampleRate / VOICE_SAMPLE_RATE)));
    let sum = 0;
    for (let frame = first; frame < end; frame++)
      for (let channel = 0; channel < channels; channel++) sum += input.getInt16((frame * channels + channel) * 2, true);
    output[index] = Math.round(sum / ((end - first) * channels));
  }
  return output;
}

/** Energy-based phrase detection. Bounded preroll; silence never submits a turn. */
export class VoicePhraseDetector {
  private preroll: Int16Array[] = [];
  private frames: Int16Array[] = [];
  private samples = 0;
  private speech = 0;
  private silence = 0;
  private consecutive = 0;
  private active = false;
  private noise = -60;
  reset() {
    this.preroll = []; this.frames = []; this.samples = 0; this.speech = 0;
    this.silence = 0; this.consecutive = 0; this.active = false; this.noise = -60;
  }
  push(frame: Int16Array): Int16Array | null {
    if (!frame.length || frame.length > VOICE_SAMPLE_RATE) return null;
    let energy = 0;
    for (const sample of frame) energy += (sample / 32768) ** 2;
    const db = 20 * Math.log10(Math.max(0.000001, Math.sqrt(energy / frame.length)));
    const duration = frame.length / VOICE_SAMPLE_RATE;
    const voiced = db > Math.max(-42, this.noise + 12);
    if (!this.active) {
      if (!voiced) this.noise = this.noise * 0.9 + db * 0.1;
      this.preroll.push(frame.slice());
      while (this.preroll.reduce((count, chunk) => count + chunk.length, 0) > VOICE_SAMPLE_RATE * 0.35 && this.preroll.length > 1) this.preroll.shift();
      this.consecutive = voiced ? this.consecutive + duration : 0;
      if (this.consecutive < 0.16) return null;
      this.active = true; this.frames = this.preroll; this.preroll = [];
      this.samples = this.frames.reduce((count, chunk) => count + chunk.length, 0);
      this.speech = this.consecutive;
      return null;
    }
    this.frames.push(frame.slice()); this.samples += frame.length;
    if (voiced) { this.speech += duration; this.silence = 0; } else this.silence += duration;
    if (this.silence < 1.15 && this.samples < VOICE_SAMPLE_RATE * 20) return null;
    const enoughSpeech = this.speech >= 0.3;
    const result = new Int16Array(this.samples);
    let offset = 0;
    for (const chunk of this.frames) { result.set(chunk, offset); offset += chunk.length; }
    this.reset();
    return enoughSpeech ? result : null;
  }
}
