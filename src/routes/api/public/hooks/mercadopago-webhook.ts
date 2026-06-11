import { createFileRoute } from "@tanstack/react-router";

// Mercado Pago webhook — validates x-signature header per MP docs.
// https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks
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

        if (!dataId) return new Response("ok"); // nothing to do

        try {
          // Both preapproval and authorized_payment events: refetch preapproval to get current status.
          // For authorized_payment we need to resolve its preapproval_id first.
          let preapprovalId = dataId;
          if (topic.includes("authorized_payment")) {
            const apRes = await fetch(`https://api.mercadopago.com/authorized_payments/${dataId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (apRes.ok) {
              const ap = (await apRes.json()) as { preapproval_id?: string };
              if (ap.preapproval_id) preapprovalId = ap.preapproval_id;
            }
          }

          const paRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!paRes.ok) return new Response("preapproval fetch failed", { status: 502 });
          const pa = (await paRes.json()) as {
            id: string;
            status: string; // authorized | paused | cancelled | pending
            external_reference?: string;
            next_payment_date?: string;
            payer_email?: string;
          };

          const userId = pa.external_reference;
          if (!userId) return new Response("ok");

          // Map MP status → our status
          const status =
            pa.status === "authorized"
              ? "active"
              : pa.status === "paused"
                ? "past_due"
                : pa.status === "cancelled"
                  ? "cancelled"
                  : pa.status;

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("subscriptions").upsert(
            {
              user_id: userId,
              mp_preapproval_id: pa.id,
              status,
              current_period_end: pa.next_payment_date ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
        } catch (e) {
          console.error("mp webhook err", e);
          return new Response("err", { status: 500 });
        }

        return new Response("ok");
      },
    },
  },
});
