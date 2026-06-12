import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell, PageHeader } from "@/components/AppShell";
import { cancelMpSubscription, reactivateMpSubscription } from "@/lib/mercadopago.functions";

export const Route = createFileRoute("/_authenticated/subscription")({
  component: SubscriptionPage,
});

function SubscriptionPage() {
  const { user } = useAuth();
  const cancel = useServerFn(cancelMpSubscription);
  const reactivate = useServerFn(reactivateMpSubscription);
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

  if (!sub.data) {
    return (
      <AppShell>
        <PageHeader kicker="Status" title="MINHA ASSINATURA" />
        <section className="px-6 text-center mt-10 animate-slide-up">
          <p className="text-sm text-muted font-mono">Carregando...</p>
        </section>
      </AppShell>
    );
  }

  const trialEnd = sub.data.trial_end ? new Date(sub.data.trial_end) : null;
  const periodEnd = sub.data.current_period_end ? new Date(sub.data.current_period_end) : trialEnd;
  const daysLeft = periodEnd
    ? Math.max(0, Math.ceil((periodEnd.getTime() - Date.now()) / 86400000))
    : 0;

  const isActive = sub.data.status === "active";
  const isTrial = sub.data.status === "trialing";
  const isCancelled = sub.data.status === "cancelled" || sub.data.cancel_at_period_end;
  const stillValid = (isActive || isTrial) && daysLeft > 0;

  async function doCancel() {
    if (!confirm("Cancelar assinatura? Os dias restantes continuam contando.")) return;
    setBusy(true);
    try {
      await cancel({});
      toast.success("Assinatura cancelada");
      sub.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function doReactivate() {
    setBusy(true);
    try {
      await reactivate({});
      toast.success("Reativada");
      sub.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  if (!isActive && !isTrial) {
    // not subscribed (or fully expired)
    return (
      <AppShell>
        <PageHeader kicker="Status" title="MINHA ASSINATURA" />
        <section className="px-6 text-center mt-10 animate-slide-up space-y-4">
          <p className="font-display text-2xl uppercase">Sem assinatura ativa</p>
          <Link
            to="/billing"
            className="block w-full bg-primary text-primary-foreground font-display py-3 uppercase tracking-widest text-lg"
          >
            Assine agora
          </Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader kicker="Status" title="MINHA ASSINATURA" />
      <section className="px-6 animate-slide-up [animation-delay:100ms] space-y-4">
        <div className="bg-surface ring-1 ring-border p-6 text-center">
          <p className="font-mono text-[10px] uppercase text-muted">Status</p>
          <p className="font-display text-3xl mt-1 uppercase">
            {isTrial ? "Período de teste" : "Ativa"}
          </p>
          {sub.data.cancel_at_period_end && (
            <p className="font-mono text-[10px] text-primary mt-2 uppercase">
              cancelada · expira ao fim do período
            </p>
          )}
          <div className="mt-4">
            <p className="font-display text-6xl">{daysLeft}</p>
            <p className="font-mono text-[10px] uppercase text-muted">dia{daysLeft === 1 ? "" : "s"} restante{daysLeft === 1 ? "" : "s"}</p>
          </div>
        </div>

        <Link
          to="/billing"
          className="block w-full bg-primary text-primary-foreground font-display py-3 uppercase tracking-widest text-center"
        >
          Renovar antecipado
        </Link>

        {stillValid && !sub.data.cancel_at_period_end && (
          <button
            onClick={doCancel}
            disabled={busy}
            className="block w-full ring-1 ring-border py-3 font-display uppercase tracking-widest text-sm disabled:opacity-50"
          >
            Cancelar assinatura
          </button>
        )}

        {sub.data.cancel_at_period_end && stillValid && (
          <button
            onClick={doReactivate}
            disabled={busy}
            className="block w-full ring-1 ring-primary text-primary py-3 font-display uppercase tracking-widest text-sm disabled:opacity-50"
          >
            Reativar assinatura
          </button>
        )}

        <Link to="/settings" className="block text-center text-xs font-mono uppercase text-muted py-3">
          Voltar
        </Link>
      </section>
    </AppShell>
  );
}
