import { createMaterialProcessHandler } from "../src/material-process-queue.ts";

const handler = createMaterialProcessHandler(Deno.env.toObject());
Deno.serve(handler);
