import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell, PageHeader } from "@/components/AppShell";
import { createMpCheckoutLink, cancelMpSubscription } from "@/lib/mercadopago.functions";

export const Route = createFileRoute("/_authenticated/billing")({
  component: BillingPage,
});

function BillingPage() {
  const { user } = useAuth();
  const checkout = useServerFn(createMpCheckoutLink);
  const cancelFn = useServerFn(cancelMpSubscription);
  const [busy, setBusy] = useState(false);

  const sub = useQuery({
    queryKey: ["subscription", user!.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const trialEnd = sub.data?.trial_end ? new Date(sub.data.trial_end) : null;
  const trialDays = trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000))
    : 0;
  const active = sub.data?.status === "active" || sub.data?.status === "trialing";

  async function go() {
    setBusy(true);
    try {
      const r = await checkout({});
      window.location.href = r.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao iniciar checkout");
      setBusy(false);
    }
  }

  async function cancel() {
    if (!confirm("Cancelar assinatura?")) return;
    setBusy(true);
    try {
      await cancelFn({});
      toast.success("Assinatura cancelada");
      sub.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao cancelar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <PageHeader kicker="Plano" title="MONMON PREMIUM" />

      <section className="px-6 animate-slide-up [animation-delay:100ms]">
        <div className="bg-surface ring-1 ring-border p-6">
          <p className="font-mono text-[10px] uppercase text-muted">Plano único</p>
          <p className="font-display text-5xl mt-1">
            R$ 9<span className="text-2xl">,90</span>
          </p>
          <p className="font-mono text-[10px] uppercase text-muted">por ano</p>
          <ul className="mt-4 space-y-1 text-sm">
            <li>· 7 dias grátis</li>
            <li>· Notificações no celular e smartwatch</li>
            <li>· Histórico completo</li>
            <li>· Cancele quando quiser</li>
          </ul>
          <p className="mt-3 font-mono text-[10px] uppercase text-muted">
            Pagamento via Mercado Pago
          </p>
        </div>

        {sub.data?.status === "trialing" && (
          <p className="mt-4 text-sm font-mono text-primary text-center">
            Trial · {trialDays} dia{trialDays === 1 ? "" : "s"} restantes
          </p>
        )}
        {sub.data?.status === "active" && (
          <p className="mt-4 text-sm font-mono text-primary text-center">Assinatura ativa</p>
        )}
        {sub.data?.status === "cancelled" && (
          <p className="mt-4 text-sm font-mono text-muted text-center">Assinatura cancelada</p>
        )}

        {active && sub.data?.mp_preapproval_id ? (
          <button
            onClick={cancel}
            disabled={busy}
            className="mt-6 w-full ring-1 ring-border py-3 font-display uppercase tracking-widest text-sm disabled:opacity-50"
          >
            Cancelar assinatura
          </button>
        ) : (
          <button
            onClick={go}
            disabled={busy}
            className="mt-6 w-full bg-primary text-primary-foreground py-3 font-display uppercase tracking-widest text-lg disabled:opacity-50"
          >
            {sub.data?.status === "trialing" ? "Confirmar assinatura" : "Começar 7 dias grátis"}
          </button>
        )}

        <Link
          to="/settings"
          className="block text-center mt-6 text-xs font-mono uppercase text-muted"
        >
          Voltar
        </Link>
      </section>
    </AppShell>
  );
}
