import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { createMpCheckoutLink } from "@/lib/mercadopago.functions";
import { PLANS, type PlanKey } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/billing")({
  component: BillingPage,
});

function BillingPage() {
  const checkout = useServerFn(createMpCheckoutLink);
  const [busy, setBusy] = useState<PlanKey | null>(null);

  async function go(plan: PlanKey) {
    setBusy(plan);
    try {
      const r = await checkout({ data: { plan } });
      window.location.href = r.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao iniciar checkout");
      setBusy(null);
    }
  }

  return (
    <AppShell>
      <PageHeader kicker="Planos" title="MONMON PREMIUM" />

      <section className="px-6 space-y-3 animate-slide-up [animation-delay:100ms]">
        <p className="text-center text-xs font-mono uppercase text-muted tracking-widest mb-3">
          7 dias grátis em todos
        </p>

        {(Object.keys(PLANS) as PlanKey[]).map((key) => {
          const p = PLANS[key];
          const perMonth = p.priceBRL / p.months;
          const isBest = key === "m12";
          return (
            <button
              key={key}
              onClick={() => go(key)}
              disabled={busy !== null}
              className={`w-full block text-left p-5 ring-1 transition disabled:opacity-50 ${
                isBest ? "bg-primary text-primary-foreground ring-primary" : "bg-surface ring-border"
              }`}
            >
              <div className="flex justify-between items-baseline">
                <span className="font-display text-2xl uppercase">{p.label}</span>
                {isBest && <span className="font-mono text-[9px] uppercase tracking-widest">+ econômico</span>}
              </div>
              <p className="font-display text-5xl mt-2">
                R$ {Math.floor(p.priceBRL)}
                <span className="text-2xl">,{String(p.priceBRL).split(".")[1]?.padEnd(2, "0") ?? "00"}</span>
              </p>
              <p className={`font-mono text-[10px] uppercase ${isBest ? "" : "text-muted"}`}>
                ≈ R$ {perMonth.toFixed(2)}/mês
              </p>
              <p className={`mt-3 font-mono text-[10px] uppercase tracking-widest ${isBest ? "" : "text-primary"}`}>
                {busy === key ? "abrindo checkout..." : "assinar →"}
              </p>
            </button>
          );
        })}

        <p className="text-[10px] text-muted text-center font-mono mt-4">
          Pagamento via Mercado Pago
        </p>

        <Link to="/subscription" className="block text-center mt-4 text-xs font-mono uppercase text-muted">
          Voltar
        </Link>
      </section>
    </AppShell>
  );
}
