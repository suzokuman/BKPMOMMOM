import { createFileRoute } from "@tanstack/react-router";

// Stripe webhook — verifies signature via HMAC-SHA256
async function verifyStripeSignature(payload: string, sigHeader: string, secret: string) {
  const parts = Object.fromEntries(sigHeader.split(",").map((kv) => kv.split("=")));
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`));
  const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === v1;
}

export const Route = createFileRoute("/api/public/hooks/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) return new Response("not configured", { status: 503 });
        const sig = request.headers.get("stripe-signature");
        const body = await request.text();
        if (!sig || !(await verifyStripeSignature(body, sig, secret))) {
          return new Response("bad signature", { status: 400 });
        }
        const event = JSON.parse(body) as { type: string; data: { object: Record<string, unknown> } };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const obj = event.data.object as Record<string, unknown>;
        try {
          if (event.type === "checkout.session.completed") {
            const userId = (obj.client_reference_id || (obj.metadata as { user_id?: string } | undefined)?.user_id) as string | undefined;
            const customerId = obj.customer as string | undefined;
            const subId = obj.subscription as string | undefined;
            if (userId) {
              await supabaseAdmin.from("subscriptions").upsert({
                user_id: userId,
                stripe_customer_id: customerId,
                stripe_subscription_id: subId,
                status: "active",
                updated_at: new Date().toISOString(),
              }, { onConflict: "user_id" });
            }
          } else if (event.type.startsWith("customer.subscription.")) {
            const subId = obj.id as string;
            const customerId = obj.customer as string;
            const status = obj.status as string;
            const trialEnd = obj.trial_end as number | null;
            const periodEnd = obj.current_period_end as number | null;
            const cancelAtEnd = obj.cancel_at_period_end as boolean;
            // find user by customer
            const { data: existing } = await supabaseAdmin
              .from("subscriptions")
              .select("user_id")
              .eq("stripe_customer_id", customerId)
              .maybeSingle();
            if (existing) {
              await supabaseAdmin.from("subscriptions").update({
                stripe_subscription_id: subId,
                status,
                trial_end: trialEnd ? new Date(trialEnd * 1000).toISOString() : null,
                current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
                cancel_at_period_end: !!cancelAtEnd,
                updated_at: new Date().toISOString(),
              }).eq("user_id", existing.user_id);
            }
          }
        } catch (e) {
          console.error("stripe webhook err", e);
          return new Response("err", { status: 500 });
        }
        return new Response("ok");
      },
    },
  },
});
