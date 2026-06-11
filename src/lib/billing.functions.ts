import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createBillingCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!stripeKey || !priceId) throw new Error("Stripe ainda não configurado. Volte em alguns minutos.");

    const { userId } = context;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id, trial_end")
      .eq("user_id", userId)
      .maybeSingle();

    const origin = process.env.SITE_URL || "https://project--47c42f38-f030-4105-878e-c7b088f77ea9.lovable.app";
    const params = new URLSearchParams();
    params.append("mode", "subscription");
    params.append("line_items[0][price]", priceId);
    params.append("line_items[0][quantity]", "1");
    params.append("success_url", `${origin}/billing?ok=1`);
    params.append("cancel_url", `${origin}/billing?cancel=1`);
    params.append("client_reference_id", userId);
    params.append("metadata[user_id]", userId);
    if (sub?.stripe_customer_id) {
      params.append("customer", sub.stripe_customer_id);
    } else if (profile?.email) {
      params.append("customer_email", profile.email);
    }
    // 7-day trial only if not used yet
    if (!sub?.trial_end || new Date(sub.trial_end) > new Date()) {
      params.append("subscription_data[trial_period_days]", "7");
    }

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Stripe: ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { url: string };
    return { url: json.url };
  });

export const createBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) throw new Error("Stripe não configurado.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!sub?.stripe_customer_id) throw new Error("Sem assinatura ativa.");
    const origin = process.env.SITE_URL || "https://project--47c42f38-f030-4105-878e-c7b088f77ea9.lovable.app";
    const params = new URLSearchParams();
    params.append("customer", sub.stripe_customer_id);
    params.append("return_url", `${origin}/settings`);
    const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as { url: string };
    return { url: json.url };
  });
