import { createClient } from "@supabase/supabase-js";
import { dueReminders, type Snapshot } from "@compa/domain";
export function createReminderHandler(env: Record<string, string | undefined>) {
  const db = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return async (req: Request) => {
    if (
      req.method !== "POST" ||
      !env.CRON_SECRET ||
      req.headers.get("Authorization") !== "Bearer " + env.CRON_SECRET
    )
      return new Response("Unauthorized", { status: 401 });
    let sent = 0,
      disabled = 0;
    try {
      const { data: receipts, error: receiptError } = await db
        .from("push_deliveries")
        .select("id,ticket_id,device_token")
        .eq("status", "SENT")
        .lt("created_at", new Date(Date.now() - 15 * 60000).toISOString())
        .limit(300);
      if (receiptError) throw receiptError;
      if (receipts?.length) {
        const response = await fetch(
          "https://exp.host/--/api/v2/push/getReceipts",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(env.EXPO_ACCESS_TOKEN
                ? { Authorization: "Bearer " + env.EXPO_ACCESS_TOKEN }
                : {}),
            },
            body: JSON.stringify({ ids: receipts.map((r) => r.ticket_id) }),
            signal: AbortSignal.timeout(20000),
          },
        );
        if (response.ok) {
          const body = await response.json();
          for (const receipt of receipts) {
            const result = body.data?.[receipt.ticket_id];
            if (!result) continue;
            if (result.details?.error === "DeviceNotRegistered") {
              await db
                .from("devices")
                .update({ enabled: false })
                .eq("token", receipt.device_token);
              disabled++;
            }
            await db
              .from("push_deliveries")
              .update({
                status: result.status === "ok" ? "DELIVERED" : "FAILED",
              })
              .eq("id", receipt.id);
          }
        }
      }
      const { data: users, error } = await db
        .from("student_states")
        .select("user_id,state")
        .limit(1000);
      if (error) throw error;
      for (const row of users ?? []) {
        const s = row.state as Snapshot;
        const { data: control } = await db
          .from("account_controls")
          .select("deleting")
          .eq("user_id", row.user_id)
          .maybeSingle();
        if (control?.deleting) continue;
        for (const draft of dueReminders(s, new Date().toISOString())) {
          const date = draft.date;
          await db.rpc("append_notification", {
            p_user: row.user_id,
            p_notification: {
              id: draft.id + ":" + date,
              title: draft.title,
              body: draft.body,
              route: draft.route,
              created_at: new Date().toISOString(),
            },
          });
          const { data: devices, error: deviceError } = await db
            .from("devices")
            .select("token")
            .eq("user_id", row.user_id)
            .eq("enabled", true);
          if (deviceError) throw deviceError;
          for (const device of devices ?? []) {
            const { data: delivery, error: deliveryError } = await db
              .from("push_deliveries")
              .insert({
                user_id: row.user_id,
                device_token: device.token,
                local_date: date,
                kind: draft.id,
              })
              .select("id")
              .single();
            if (deliveryError) {
              if (deliveryError.code === "23505") continue;
              throw deliveryError;
            }
            // Claim precedes the external send. Ambiguous network failures are not resent blindly.
            try {
              const response = await fetch(
                "https://exp.host/--/api/v2/push/send",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(env.EXPO_ACCESS_TOKEN
                      ? { Authorization: "Bearer " + env.EXPO_ACCESS_TOKEN }
                      : {}),
                  },
                  body: JSON.stringify({
                    to: device.token,
                    title: draft.title,
                    body: draft.body,
                    data: { url: "compavirtual://?view=" + draft.route },
                    sound: "default",
                    channelId: "study-reminders",
                  }),
                  signal: AbortSignal.timeout(20000),
                },
              );
              if (!response.ok) throw Error("PUSH_HTTP");
              const result = (await response.json()).data;
              if (
                result.status === "error" &&
                result.details?.error === "DeviceNotRegistered"
              ) {
                await db
                  .from("devices")
                  .update({ enabled: false })
                  .eq("token", device.token);
                disabled++;
              }
              await db
                .from("push_deliveries")
                .update({
                  status: result.status === "ok" ? "SENT" : "FAILED",
                  ticket_id: result.id ?? null,
                })
                .eq("id", delivery.id);
              if (result.status === "ok") sent++;
            } catch {
              await db
                .from("push_deliveries")
                .update({ status: "UNKNOWN" })
                .eq("id", delivery.id);
            }
          }
        }
      }
      await db.rpc("purge_chat_history");
      return Response.json({ sent, disabled });
    } catch {
      return Response.json({ error: "REMINDER_RUN_FAILED" }, { status: 500 });
    }
  };
}
