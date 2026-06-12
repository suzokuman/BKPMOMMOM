import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { createMpCheckoutLink } from "@/lib/mercadopago.functions";
import { PURCHASE } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/billing")({
  component: BillingPage,
});

function BillingPage() {
  const checkout = useServerFn(createMpCheckoutLink);
  const [busy, setBusy] = useState(false);

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

  return (
    <AppShell>
      <PageHeader kicker="Comprar acesso" title="MONMON 90 DIAS" />

      <section className="px-6 space-y-4 animate-slide-up [animation-delay:100ms]">
        <div className="bg-primary text-primary-foreground p-6 ring-1 ring-primary">
          <p className="font-mono text-[10px] uppercase tracking-widest opacity-80">Pagamento único</p>
          <p className="font-display text-6xl mt-2">
            R$ {Math.floor(PURCHASE.amountBRL)}
            <span className="text-3xl">,{String(PURCHASE.amountBRL).split(".")[1]?.padEnd(2, "0") ?? "00"}</span>
          </p>
          <p className="font-mono text-xs uppercase mt-1">{PURCHASE.days} dias de acesso completo</p>
        </div>

        <ul className="text-sm space-y-2 px-1">
          <li>✓ Sem assinatura recorrente</li>
          <li>✓ Sem renovação automática</li>
          <li>✓ Acesso liberado na hora após o pagamento</li>
          <li>✓ Compre novamente quando quiser para estender</li>
        </ul>

        <button
          onClick={go}
          disabled={busy}
          className="w-full bg-primary text-primary-foreground font-display py-4 uppercase tracking-widest text-lg disabled:opacity-50"
        >
          {busy ? "abrindo checkout..." : "comprar agora →"}
        </button>

        <p className="text-[10px] text-muted text-center font-mono">
          Pagamento via Mercado Pago · Pix, cartão ou boleto
        </p>

        <Link to="/subscription" className="block text-center mt-4 text-xs font-mono uppercase text-muted">
          Voltar
        </Link>
      </section>
    </AppShell>
  );
}
