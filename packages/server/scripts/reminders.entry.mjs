import { createReminderHandler } from "../src/reminders.ts";

Deno.serve(createReminderHandler(Deno.env.toObject()));
