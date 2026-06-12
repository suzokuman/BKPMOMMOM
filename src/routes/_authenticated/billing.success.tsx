import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/billing/success")({
  component: SuccessPage,
});

function SuccessPage() {
  return (
    <AppShell>
      <section className="px-6 mt-20 text-center animate-slide-up space-y-4">
        <CheckCircle2 className="size-20 text-primary mx-auto" strokeWidth={1.5} />
        <h1 className="font-display text-3xl uppercase tracking-tight">PAGAMENTO RECEBIDO</h1>
        <p className="text-sm text-muted">
          Obrigado por assinar o MonMon Premium. Sua assinatura será ativada em instantes.
        </p>
        <p className="font-mono text-[10px] text-muted uppercase tracking-widest">
          A confirmação pode levar alguns minutos
        </p>
        <Link
          to="/subscription"
          className="block w-full bg-primary text-primary-foreground font-display py-3 uppercase tracking-widest text-lg mt-6"
        >
          Ver minha assinatura
        </Link>
        <Link to="/app" className="block text-xs font-mono uppercase text-muted py-2">
          Ir para o app
        </Link>
      </section>
    </AppShell>
  );
}
