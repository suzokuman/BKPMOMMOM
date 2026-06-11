import { createFileRoute } from "@tanstack/react-router";
import { buildPushPayload, type PushSubscription as WebPushSub } from "@block65/webcrypto-web-push";

type NotifKind =
  | "medication"
  | "protein_reminder"
  | "summary_morning"
  | "summary_night"
  | "goal_almost_protein"
  | "goal_done_protein"
  | "goal_almost_kcal"
  | "goal_done_kcal";

function parseHHMM(s: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

function localNow(tz: string) {
  // returns {y, mo, d, h, mi} in user's tz
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour"), mi: get("minute") };
}

function isoDateLocal(tz: string): string {
  const n = localNow(tz);
  return `${n.y.toString().padStart(4, "0")}-${n.mo.toString().padStart(2, "0")}-${n.d.toString().padStart(2, "0")}`;
}

function withinWindow(targetH: number, targetM: number, nowH: number, nowM: number, windowMin = 5) {
  const t = targetH * 60 + targetM;
  const n = nowH * 60 + nowM;
  return Math.abs(t - n) <= windowMin;
}

export const Route = createFileRoute("/api/public/hooks/notifications-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? request.headers.get("Apikey");
        if (apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("unauthorized", { status: 401 });
        }
        const vapid = {
          subject: process.env.VAPID_SUBJECT || "mailto:hello@monmon.app",
          publicKey: process.env.VAPID_PUBLIC_KEY,
          privateKey: process.env.VAPID_PRIVATE_KEY,
        };
        if (!vapid.publicKey || !vapid.privateKey) {
          return Response.json({ ok: false, error: "VAPID keys missing" }, { status: 500 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: users, error } = await supabaseAdmin
          .from("notification_settings")
          .select("*")
          .eq("enabled", true);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        const results = { tried: 0, sent: 0, skipped: 0 };

        for (const s of users ?? []) {
          const tz = s.timezone || "America/Sao_Paulo";
          const n = localNow(tz);
          const today = isoDateLocal(tz);
          const todos: { kind: NotifKind; ref: string; title: string; body: string; url?: string }[] = [];

          // 1. Medications scheduled within window
          const dayStart = new Date(`${today}T00:00:00`);
          const dayEnd = new Date(`${today}T23:59:59`);
          const { data: meds } = await supabaseAdmin
            .from("medications")
            .select("id, name, dose_mg, scheduled_at, taken")
            .eq("user_id", s.user_id)
            .eq("taken", false)
            .gte("scheduled_at", dayStart.toISOString())
            .lte("scheduled_at", dayEnd.toISOString());
          for (const m of meds ?? []) {
            const local = new Date(m.scheduled_at).toLocaleString("en-US", {
              timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
            });
            const [mh, mm] = local.split(":").map(Number);
            if (withinWindow(mh, mm, n.h, n.mi)) {
              todos.push({
                kind: "medication",
                ref: `med:${m.id}`,
                title: "Hora da medicação",
                body: `${m.name} · ${m.dose_mg}mg`,
                url: "/medications",
              });
            }
          }

          // 2. Protein reminders at fixed times
          for (const t of s.protein_reminder_times ?? []) {
            const parsed = parseHHMM(t);
            if (!parsed) continue;
            if (withinWindow(parsed.h, parsed.m, n.h, n.mi)) {
              todos.push({
                kind: "protein_reminder",
                ref: `proteinrem:${today}:${t}`,
                title: "Lembrete de proteína",
                body: "Hora de registrar sua proteína.",
                url: "/protein",
              });
            }
          }

          // 3. Summaries
          if (s.summary_morning_time) {
            const p = parseHHMM(s.summary_morning_time);
            if (p && withinWindow(p.h, p.m, n.h, n.mi)) {
              todos.push({
                kind: "summary_morning",
                ref: `sum_am:${today}`,
                title: "Bom dia 👋",
                body: "Hora de planejar seu dia no MonMon.",
                url: "/app",
              });
            }
          }
          if (s.summary_night_time) {
            const p = parseHHMM(s.summary_night_time);
            if (p && withinWindow(p.h, p.m, n.h, n.mi)) {
              todos.push({
                kind: "summary_night",
                ref: `sum_pm:${today}`,
                title: "Resumo do dia",
                body: "Como foi com suas metas hoje?",
                url: "/history",
              });
            }
          }

          // 4. Goal alerts
          if (s.goal_alerts) {
            const [pg, pi, cg, ci] = await Promise.all([
              supabaseAdmin.from("daily_protein_goals").select("target_g").eq("user_id", s.user_id).eq("date", today).maybeSingle(),
              supabaseAdmin.from("protein_items").select("grams,checked").eq("user_id", s.user_id).eq("date", today),
              supabaseAdmin.from("daily_calorie_goals").select("target_kcal").eq("user_id", s.user_id).eq("date", today).maybeSingle(),
              supabaseAdmin.from("calorie_items").select("kcal,checked").eq("user_id", s.user_id).eq("date", today),
            ]);
            const pdone = (pi.data ?? []).filter((x) => x.checked).reduce((a, b) => a + Number(b.grams), 0);
            const ptarget = Number(pg.data?.target_g ?? 0);
            const kdone = (ci.data ?? []).filter((x) => x.checked).reduce((a, b) => a + Number(b.kcal), 0);
            const ktarget = Number(cg.data?.target_kcal ?? 0);
            if (ptarget > 0) {
              const pct = pdone / ptarget;
              if (pct >= 1) {
                todos.push({ kind: "goal_done_protein", ref: `pgoal_done:${today}`, title: "Meta de proteína batida 💪", body: `${Math.round(pdone)}g / ${ptarget}g`, url: "/protein" });
              } else if (pct >= 0.9) {
                todos.push({ kind: "goal_almost_protein", ref: `pgoal_almost:${today}`, title: "Quase lá!", body: `Faltam ${Math.round(ptarget - pdone)}g de proteína.`, url: "/protein" });
              }
            }
            if (ktarget > 0) {
              const pct = kdone / ktarget;
              if (pct >= 1) {
                todos.push({ kind: "goal_done_kcal", ref: `kgoal_done:${today}`, title: "Meta calórica atingida", body: `${Math.round(kdone)} / ${ktarget} kcal`, url: "/calories" });
              } else if (pct >= 0.9) {
                todos.push({ kind: "goal_almost_kcal", ref: `kgoal_almost:${today}`, title: "Quase batendo as calorias", body: `Faltam ${Math.round(ktarget - kdone)} kcal.`, url: "/calories" });
              }
            }
          }

          if (todos.length === 0) continue;

          // Load subscriptions
          const { data: subs } = await supabaseAdmin
            .from("push_subscriptions")
            .select("*")
            .eq("user_id", s.user_id);
          if (!subs || subs.length === 0) continue;

          for (const todo of todos) {
            // dedupe via notification_log
            const ins = await supabaseAdmin
              .from("notification_log")
              .insert({ user_id: s.user_id, kind: todo.kind, ref_key: todo.ref })
              .select("id");
            if (ins.error) {
              // duplicate (already sent) → skip
              results.skipped++;
              continue;
            }
            for (const sub of subs) {
              results.tried++;
              try {
                const wpSub: WebPushSub = {
                  endpoint: sub.endpoint,
                  expirationTime: null,
                  keys: { auth: sub.auth, p256dh: sub.p256dh },
                };
                const payload = await buildPushPayload(
                  {
                    data: { title: todo.title, body: todo.body, url: todo.url, tag: todo.kind },
                    options: { ttl: 60 * 60, urgency: "high" },
                  },
                  wpSub,
                  vapid,
                );
                const res = await fetch(sub.endpoint, {
                  method: payload.method,
                  headers: payload.headers,
                  body: payload.body,
                });
                if (res.ok || res.status === 201) results.sent++;
                else if (res.status === 404 || res.status === 410) {
                  await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
                }
              } catch (e) {
                console.error("push error", e);
              }
            }
          }
        }

        return Response.json({ ok: true, ...results });
      },
    },
  },
});
