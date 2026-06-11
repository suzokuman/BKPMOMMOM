import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, BellOff, X, Plus, BarChart3, LogOut, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell, PageHeader } from "@/components/AppShell";
import { enablePush, disablePush, getPushSubscription, pushSupported } from "@/lib/push";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [pushOn, setPushOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushSubscription().then((s) => setPushOn(!!s));
  }, []);

  const settings = useQuery({
    queryKey: ["notif-settings", user!.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

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

  const save = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase
        .from("notification_settings")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-settings"] });
      toast.success("Salvo");
    },
    onError: (e) => toast.error(e.message),
  });

  async function togglePush() {
    setBusy(true);
    try {
      if (pushOn) {
        await disablePush();
        setPushOn(false);
        toast.success("Notificações desligadas");
      } else {
        const r = await enablePush(user!.id);
        if (r.ok) {
          setPushOn(true);
          toast.success("Notificações ativadas");
        } else {
          toast.error(r.error);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const s = settings.data;
  const trialEnd = sub.data?.trial_end ? new Date(sub.data.trial_end) : null;
  const trialDays = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000)) : 0;

  return (
    <AppShell>
      <PageHeader kicker="Configuração" title="AJUSTES" />

      <section className="px-6 space-y-3 animate-slide-up [animation-delay:50ms]">
        <Link
          to="/billing"
          className="bg-surface ring-1 ring-border p-4 flex justify-between items-center"
        >
          <div className="flex items-center gap-3">
            <CreditCard className="size-4 text-primary" />
            <div>
              <p className="text-sm font-bold">Assinatura</p>
              <p className="text-[10px] font-mono uppercase text-muted">
                {sub.data?.status === "active"
                  ? "Ativa"
                  : sub.data?.status === "trialing"
                  ? `Trial · ${trialDays} dia${trialDays === 1 ? "" : "s"}`
                  : "Inativa"}
              </p>
            </div>
          </div>
          <span className="text-xs text-muted">→</span>
        </Link>
      </section>

      <section className="px-6 mt-8 animate-slide-up [animation-delay:100ms]">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted mb-3">Notificações</h2>
        <div className="bg-surface ring-1 ring-border p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {pushOn ? <Bell className="size-4 text-primary" /> : <BellOff className="size-4 text-muted" />}
            <div>
              <p className="text-sm font-bold">Push no celular/relógio</p>
              <p className="text-[10px] font-mono uppercase text-muted">
                {pushSupported() ? (pushOn ? "Ligado" : "Desligado") : "Não suportado neste navegador"}
              </p>
            </div>
          </div>
          <button
            onClick={togglePush}
            disabled={busy || !pushSupported()}
            className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest ${
              pushOn ? "bg-primary text-primary-foreground" : "ring-1 ring-border"
            } disabled:opacity-50`}
          >
            {pushOn ? "ON" : "OFF"}
          </button>
        </div>
        <p className="text-[10px] text-muted mt-2 font-mono">
          Funciona instalado como app. Adicione MonMon à tela inicial.
        </p>
      </section>

      {s && (
        <>
          <section className="px-6 mt-8 animate-slide-up [animation-delay:150ms]">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted mb-3">
              Lembretes de proteína
            </h2>
            <TimesEditor
              times={s.protein_reminder_times ?? []}
              onChange={(t) => save.mutate({ protein_reminder_times: t })}
            />
          </section>

          <section className="px-6 mt-8 animate-slide-up [animation-delay:200ms]">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted mb-3">
              Resumo diário
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <TimeField
                label="Manhã"
                value={s.summary_morning_time ?? ""}
                onChange={(v) => save.mutate({ summary_morning_time: v || null })}
              />
              <TimeField
                label="Noite"
                value={s.summary_night_time ?? ""}
                onChange={(v) => save.mutate({ summary_night_time: v || null })}
              />
            </div>
          </section>

          <section className="px-6 mt-8 animate-slide-up [animation-delay:250ms]">
            <label className="bg-surface ring-1 ring-border p-4 flex justify-between items-center">
              <span className="text-sm font-bold">Alerta perto da meta</span>
              <input
                type="checkbox"
                checked={s.goal_alerts}
                onChange={(e) => save.mutate({ goal_alerts: e.target.checked })}
                className="size-5 accent-primary"
              />
            </label>
          </section>
        </>
      )}

      <section className="px-6 mt-10 grid grid-cols-2 gap-2 animate-slide-up [animation-delay:300ms]">
        <Link to="/history" className="bg-surface ring-1 ring-border p-4 flex items-center gap-2">
          <BarChart3 className="size-4 text-primary" />
          <span className="text-xs font-mono uppercase">Histórico</span>
        </Link>
        <button
          onClick={() => supabase.auth.signOut()}
          className="bg-surface ring-1 ring-border p-4 flex items-center gap-2"
        >
          <LogOut className="size-4 text-muted" />
          <span className="text-xs font-mono uppercase">Sair</span>
        </button>
      </section>
    </AppShell>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="bg-surface ring-1 ring-border p-3 flex flex-col">
      <span className="font-mono text-[9px] uppercase text-muted">{label}</span>
      <input
        type="time"
        value={value ? value.slice(0, 5) : ""}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-sm font-mono mt-1 focus:outline-none"
      />
    </label>
  );
}

function TimesEditor({ times, onChange }: { times: string[]; onChange: (t: string[]) => void }) {
  const [draft, setDraft] = useState("");
  function add() {
    if (!draft) return;
    if (times.includes(draft)) return;
    onChange([...times, draft].sort());
    setDraft("");
  }
  function remove(t: string) {
    onChange(times.filter((x) => x !== t));
  }
  return (
    <div className="bg-surface ring-1 ring-border p-4">
      <div className="flex flex-wrap gap-2 mb-3">
        {times.length === 0 && <span className="text-[10px] font-mono text-muted">Nenhum horário.</span>}
        {times.map((t) => (
          <span key={t} className="bg-primary/10 text-primary font-mono text-xs px-2 py-1 flex items-center gap-1">
            {t}
            <button onClick={() => remove(t)} aria-label="remover"><X className="size-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="time"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="bg-background ring-1 ring-border px-3 py-2 text-sm font-mono flex-1 focus:outline-none focus:ring-primary"
        />
        <button
          onClick={add}
          className="bg-primary text-primary-foreground px-3 font-display uppercase tracking-widest text-sm"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}
