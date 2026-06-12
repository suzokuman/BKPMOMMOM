import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell, PageHeader } from "@/components/AppShell";
import { todayStr } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

type ReportPayload = {
  kcal?: number;
  kcal_target?: number;
  protein?: number;
  protein_target?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  meds_taken?: number;
  meds_total?: number;
  weight_kg?: number | null;
};

function HistoryPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [savingEmail, setSavingEmail] = useState(false);

  const q = useQuery({
    queryKey: ["history", user!.id],
    queryFn: async () => {
      const from = todayStr(subDays(new Date(), 29));
      const [reports, settings] = await Promise.all([
        supabase.from("daily_reports").select("*").gte("report_date", from).order("report_date", { ascending: false }),
        supabase.from("notification_settings").select("daily_report_email, report_email").eq("user_id", user!.id).maybeSingle(),
      ]);
      return { reports: reports.data ?? [], settings: settings.data };
    },
  });

  const [email, setEmail] = useState("");
  const [autoSend, setAutoSend] = useState(false);

  // sync from settings once loaded
  useState(() => {
    if (q.data?.settings) {
      setEmail(q.data.settings.report_email ?? user?.email ?? "");
      setAutoSend(q.data.settings.daily_report_email);
    }
  });

  const saveEmail = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notification_settings")
        .update({ daily_report_email: autoSend, report_email: email || null })
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["history"] });
      toast.success("Salvo");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <AppShell>
      <PageHeader kicker="Relatórios" title="HISTÓRICO" />

      <section className="px-6 animate-slide-up [animation-delay:50ms]">
        <div className="bg-surface ring-1 ring-border p-4 space-y-3">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted">Envio por email</h2>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="w-full bg-background ring-1 ring-border px-3 py-2 text-sm focus:outline-none focus:ring-primary"
          />
          <label className="flex justify-between items-center">
            <span className="text-sm">Enviar relatório diário às 00:00</span>
            <input
              type="checkbox"
              checked={autoSend}
              onChange={(e) => setAutoSend(e.target.checked)}
              className="size-5 accent-primary"
            />
          </label>
          <button
            onClick={() => {
              setSavingEmail(true);
              saveEmail.mutate(undefined, { onSettled: () => setSavingEmail(false) });
            }}
            disabled={savingEmail}
            className="w-full bg-primary text-primary-foreground py-2 font-display uppercase tracking-widest text-sm disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </section>

      <section className="px-6 mt-6 space-y-2 animate-slide-up [animation-delay:100ms]">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted mb-2">
          Últimos 30 dias
        </h2>
        {(q.data?.reports ?? []).map((r) => {
          const p = r.payload as ReportPayload;
          return (
            <div key={r.id} className="bg-surface ring-1 ring-border p-3">
              <div className="flex justify-between items-center">
                <p className="font-display text-base">
                  {format(new Date(r.report_date + "T12:00"), "dd MMM yyyy", { locale: ptBR })}
                </p>
                {r.email_sent_at && (
                  <span className="font-mono text-[9px] text-primary uppercase flex items-center gap-1">
                    <Mail className="size-3" /> enviado
                  </span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 mt-2 text-center">
                <Mini label="Kcal" v={p.kcal} t={p.kcal_target} />
                <Mini label="Prot" v={p.protein} t={p.protein_target} suffix="g" />
                <Mini label="Doses" v={p.meds_taken} t={p.meds_total} />
                <Mini label="Peso" v={p.weight_kg} suffix="kg" />
              </div>
            </div>
          );
        })}
        {(q.data?.reports ?? []).length === 0 && (
          <p className="text-center text-xs text-muted font-mono uppercase py-6">
            Os relatórios são gerados automaticamente toda meia-noite.
          </p>
        )}
      </section>
    </AppShell>
  );
}

function Mini({ label, v, t, suffix }: { label: string; v?: number | null; t?: number; suffix?: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase text-muted">{label}</p>
      <p className="font-display text-base">
        {v != null ? Math.round(v) : "—"}
        {t != null && <span className="text-[10px] text-muted">/{Math.round(t)}</span>}
        {suffix && v != null && <span className="text-[10px] text-muted">{suffix}</span>}
      </p>
    </div>
  );
}
