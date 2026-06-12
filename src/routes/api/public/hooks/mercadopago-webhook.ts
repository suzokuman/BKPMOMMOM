import { createFileRoute } from "@tanstack/react-router";

// Mercado Pago webhook for one-time payments.
// Verifies x-signature header (HMAC SHA-256 with secret).
async function verifyMpSignature(opts: {
  signatureHeader: string | null;
  requestIdHeader: string | null;
  dataId: string | null;
  secret: string;
}) {
  const { signatureHeader, requestIdHeader, dataId, secret } = opts;
  if (!signatureHeader || !requestIdHeader || !dataId) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => kv.trim().split("=").map((s) => s.trim())),
  ) as Record<string, string>;
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  const manifest = `id:${dataId};request-id:${requestIdHeader};ts:${ts};`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(manifest));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expected === v1;
}

export const Route = createFileRoute("/api/public/hooks/mercadopago-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
        const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
        if (!token || !secret) return new Response("not configured", { status: 503 });

        const url = new URL(request.url);
        const body = await request.text();
        let payload: Record<string, unknown> = {};
        try {
          payload = body ? (JSON.parse(body) as Record<string, unknown>) : {};
        } catch {
          payload = {};
        }

        const dataId =
          url.searchParams.get("data.id") ||
          url.searchParams.get("id") ||
          ((payload.data as { id?: string | number } | undefined)?.id?.toString() ?? null);
        const topic =
          url.searchParams.get("type") ||
          url.searchParams.get("topic") ||
          (payload.type as string | undefined) ||
          (payload.action as string | undefined) ||
          "";

        const ok = await verifyMpSignature({
          signatureHeader: request.headers.get("x-signature"),
          requestIdHeader: request.headers.get("x-request-id"),
          dataId,
          secret,
        });
        if (!ok) return new Response("bad signature", { status: 401 });

        if (!dataId) return new Response("ok");
        // We only care about payment events
        if (!topic.includes("payment")) return new Response("ok");

        try {
          const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!payRes.ok) return new Response("payment fetch failed", { status: 502 });
          const pay = (await payRes.json()) as {
            id: number;
            status: string; // approved | pending | rejected | cancelled | refunded
            external_reference?: string;
            transaction_amount?: number;
            date_approved?: string;
            metadata?: { user_id?: string };
          };

          const userId =
            pay.metadata?.user_id || (pay.external_reference?.split("|")[0] ?? null);
          if (!userId) return new Response("ok");

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const paymentId = String(pay.id);

          // Idempotency: skip if this payment is already approved in our DB
          const { data: existing } = await supabaseAdmin
            .from("purchases")
            .select("id, status")
            .eq("mp_payment_id", paymentId)
            .maybeSingle();

          if (existing?.status === "approved") return new Response("ok");

          if (pay.status !== "approved") {
            // Just record/update status, no period grant
            await supabaseAdmin
              .from("purchases")
              .update({
                status: pay.status,
                mp_payment_id: paymentId,
                raw: pay as unknown as Record<string, unknown>,
                updated_at: new Date().toISOString(),
              })
              .eq("mp_external_reference", pay.external_reference ?? "");
            return new Response("ok");
          }

          // Approved → grant 90 days, summing from max(now, current period_end)
          const { data: sub } = await supabaseAdmin
            .from("subscriptions")
            .select("current_period_end, trial_end")
            .eq("user_id", userId)
            .maybeSingle();

          const now = Date.now();
          const currentEnd = sub?.current_period_end ? new Date(sub.current_period_end).getTime() : 0;
          const trialEnd = sub?.trial_end ? new Date(sub.trial_end).getTime() : 0;
          const baseline = Math.max(now, currentEnd, trialEnd);
          const newEnd = new Date(baseline + 90 * 86400000);
          const periodStart = new Date(Math.max(now, currentEnd, trialEnd));

          // Upsert subscription (no recurring fields)
          await supabaseAdmin.from("subscriptions").upsert(
            {
              user_id: userId,
              status: "active",
              current_period_end: newEnd.toISOString(),
              cancel_at_period_end: false,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );

          // Upsert purchase as approved (match by mp_payment_id OR external_reference)
          if (existing) {
            await supabaseAdmin
              .from("purchases")
              .update({
                status: "approved",
                mp_payment_id: paymentId,
                paid_at: pay.date_approved ?? new Date().toISOString(),
                period_start: periodStart.toISOString(),
                period_end: newEnd.toISOString(),
                raw: pay as unknown as Record<string, unknown>,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existing.id);
          } else {
            await supabaseAdmin.from("purchases").insert({
              user_id: userId,
              amount_brl: pay.transaction_amount ?? 19.9,
              days_granted: 90,
              status: "approved",
              mp_payment_id: paymentId,
              mp_external_reference: pay.external_reference ?? null,
              paid_at: pay.date_approved ?? new Date().toISOString(),
              period_start: periodStart.toISOString(),
              period_end: newEnd.toISOString(),
              raw: pay as unknown as Record<string, unknown>,
            });
          }
        } catch (e) {
          console.error("mp webhook err", e);
          return new Response("err", { status: 500 });
        }

        return new Response("ok");
      },
    },
  },
});
