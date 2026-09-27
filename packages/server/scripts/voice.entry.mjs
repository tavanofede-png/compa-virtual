import { createVoiceHandler } from "../src/voice-input.ts";
Deno.serve(createVoiceHandler(Deno.env.toObject()));
