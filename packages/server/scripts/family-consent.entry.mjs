import { createFamilyAccessHandler } from "../src/family-access.ts";
Deno.serve(createFamilyAccessHandler(Deno.env.toObject()));
