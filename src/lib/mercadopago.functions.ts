import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PURCHASE } from "@/lib/plans";

// Creates a Mercado Pago Checkout Pro preference for a one-time R$19,90 payment.
// Returns the init_point URL the user is redirected to.
export const createMpCheckoutLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) throw new Error("Mercado Pago não configurado.");

    const origin = process.env.SITE_URL || "https://diariomonmon.lovable.app";
    const isTest = token.startsWith("TEST-");

    const externalReference = `${context.userId}|${Date.now()}`;

    const body = {
      items: [
        {
          id: "monmon-90d",
          title: PURCHASE.title,
          description: PURCHASE.description,
          quantity: 1,
          currency_id: "BRL",
          unit_price: PURCHASE.amountBRL,
        },
      ],
      external_reference: externalReference,
      notification_url: `${origin}/api/public/hooks/mercadopago-webhook`,
      back_urls: {
        success: `${origin}/billing/success`,
        failure: `${origin}/billing`,
        pending: `${origin}/billing/success`,
      },
      auto_return: "approved",
      statement_descriptor: "MONMON",
      metadata: { user_id: context.userId },
    };

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`MP: ${txt.slice(0, 300)}`);
    }
    const pref = (await res.json()) as {
      id: string;
      init_point: string;
      sandbox_init_point: string;
    };

    // Record pending purchase (idempotent-ish by mp_preference_id)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("purchases").insert({
      user_id: context.userId,
      amount_brl: PURCHASE.amountBRL,
      days_granted: PURCHASE.days,
      status: "pending",
      mp_preference_id: pref.id,
      mp_external_reference: externalReference,
    });

    return {
      url: isTest ? pref.sandbox_init_point : pref.init_point,
    };
  });
