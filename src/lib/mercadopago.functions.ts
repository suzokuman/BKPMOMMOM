import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createMpCheckoutLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const planId = process.env.MERCADOPAGO_PREAPPROVAL_PLAN_ID;
    if (!planId) throw new Error("Mercado Pago ainda não configurado.");
    const origin = process.env.SITE_URL || "https://diariomonmon.lovable.app";
    const url = new URL("https://www.mercadopago.com.br/subscriptions/checkout");
    url.searchParams.set("preapproval_plan_id", planId);
    url.searchParams.set("external_reference", context.userId);
    url.searchParams.set("back_url", `${origin}/billing?ok=1`);
    return { url: url.toString() };
  });

export const cancelMpSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) throw new Error("Mercado Pago não configurado.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("mp_preapproval_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!sub?.mp_preapproval_id) throw new Error("Sem assinatura ativa.");
    const res = await fetch(`https://api.mercadopago.com/preapproval/${sub.mp_preapproval_id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (!res.ok) throw new Error(`MP: ${(await res.text()).slice(0, 200)}`);
    await supabaseAdmin
      .from("subscriptions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    return { ok: true };
  });
