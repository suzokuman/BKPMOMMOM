import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function planIdFor(key: "m3" | "m6" | "m12"): string | null {
  if (key === "m3") return process.env.MERCADOPAGO_PLAN_3M ?? null;
  if (key === "m6") return process.env.MERCADOPAGO_PLAN_6M ?? null;
  return process.env.MERCADOPAGO_PLAN_12M ?? process.env.MERCADOPAGO_PREAPPROVAL_PLAN_ID ?? null;
}

const planSchema = z.object({ plan: z.enum(["m3", "m6", "m12"]) });

export const createMpCheckoutLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => planSchema.parse(d))
  .handler(async ({ context, data }) => {
    const planId = planIdFor(data.plan);
    if (!planId) {
      throw new Error(
        `Plano ${data.plan} ainda não cadastrado no Mercado Pago. Crie o plano no painel MP e configure o ID.`,
      );
    }
    const origin = process.env.SITE_URL || "https://diariomonmon.lovable.app";
    const url = new URL("https://www.mercadopago.com.br/subscriptions/checkout");
    url.searchParams.set("preapproval_plan_id", planId);
    url.searchParams.set("external_reference", `${context.userId}|${data.plan}`);
    url.searchParams.set("back_url", `${origin}/billing/success`);
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
    if (!sub?.mp_preapproval_id) {
      // No active MP subscription — mark cancel locally so trial/period continues.
      await supabaseAdmin
        .from("subscriptions")
        .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
        .eq("user_id", context.userId);
      return { ok: true };
    }
    const res = await fetch(`https://api.mercadopago.com/preapproval/${sub.mp_preapproval_id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (!res.ok) throw new Error(`MP: ${(await res.text()).slice(0, 200)}`);
    await supabaseAdmin
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const reactivateMpSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("subscriptions")
      .update({ cancel_at_period_end: false, updated_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    return { ok: true };
  });
