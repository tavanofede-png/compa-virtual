import { createHandler } from "../src/handler.ts";

Deno.serve(createHandler(Deno.env.toObject()));
