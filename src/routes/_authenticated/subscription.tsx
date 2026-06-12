import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell, PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/subscription")({
  component: SubscriptionPage,
});

function SubscriptionPage() {
  const { user } = useAuth();

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

  const purchases = useQuery({
    queryKey: ["purchases", user!.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchases")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (!sub.data && sub.isLoading) {
    return (
      <AppShell>
        <PageHeader kicker="Status" title="MEU ACESSO" />
        <section className="px-6 text-center mt-10 animate-slide-up">
          <p className="text-sm text-muted font-mono">Carregando...</p>
        </section>
      </AppShell>
    );
  }

  const trialEnd = sub.data?.trial_end ? new Date(sub.data.trial_end) : null;
  const periodEnd = sub.data?.current_period_end ? new Date(sub.data.current_period_end) : trialEnd;
  const daysLeft = periodEnd
    ? Math.max(0, Math.ceil((periodEnd.getTime() - Date.now()) / 86400000))
    : 0;

  const isTrial = sub.data?.status === "trialing" && daysLeft > 0;
  const hasActive = daysLeft > 0;

  return (
    <AppShell>
      <PageHeader kicker="Status" title="MEU ACESSO" />
      <section className="px-6 animate-slide-up [animation-delay:100ms] space-y-4">
        <div className="bg-surface ring-1 ring-border p-6 text-center">
          <p className="font-mono text-[10px] uppercase text-muted">Status</p>
          <p className="font-display text-3xl mt-1 uppercase">
            {hasActive ? (isTrial ? "Período de teste" : "Ativo") : "Sem acesso"}
          </p>
          {hasActive && (
            <>
              <div className="mt-4">
                <p className="font-display text-6xl">{daysLeft}</p>
                <p className="font-mono text-[10px] uppercase text-muted">
                  dia{daysLeft === 1 ? "" : "s"} restante{daysLeft === 1 ? "" : "s"}
                </p>
              </div>
              {periodEnd && (
                <p className="font-mono text-[10px] uppercase text-muted mt-2">
                  expira em {periodEnd.toLocaleDateString("pt-BR")}
                </p>
              )}
            </>
          )}
        </div>

        <Link
          to="/billing"
          className="block w-full bg-primary text-primary-foreground font-display py-3 uppercase tracking-widest text-center"
        >
          {hasActive ? "Comprar mais 90 dias" : "Comprar acesso · R$ 19,90"}
        </Link>

        <p className="text-[10px] text-muted text-center font-mono">
          Sem cobrança recorrente · você decide quando renovar
        </p>

        {purchases.data && purchases.data.length > 0 && (
          <div className="mt-8">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-2">Histórico</p>
            <ul className="space-y-2">
              {purchases.data.map((p) => (
                <li key={p.id} className="bg-surface ring-1 ring-border p-3 flex justify-between items-center">
                  <div>
                    <p className="font-mono text-xs">
                      {new Date(p.created_at).toLocaleDateString("pt-BR")} · R$ {Number(p.amount_brl).toFixed(2)}
                    </p>
                    <p className="font-mono text-[10px] text-muted uppercase">
                      {p.status === "approved"
                        ? `aprovado · ${p.days_granted} dias`
                        : p.status === "pending"
                          ? "aguardando pagamento"
                          : p.status}
                    </p>
                  </div>
                  {p.status === "approved" && (
                    <span className="font-mono text-[10px] text-primary uppercase">✓</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link to="/settings" className="block text-center text-xs font-mono uppercase text-muted py-3">
          Voltar
        </Link>
      </section>
    </AppShell>
  );
}
