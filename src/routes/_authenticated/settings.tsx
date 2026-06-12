import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, BellOff, BarChart3, LogOut, CreditCard, Target } from "lucide-react";
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
  const [height, setHeight] = useState("");

  useEffect(() => {
    getPushSubscription().then((s) => setPushOn(!!s));
  }, []);

  const profile = useQuery({
    queryKey: ["profile", user!.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (profile.data?.height_cm != null) setHeight(String(profile.data.height_cm));
  }, [profile.data]);

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

  const saveHeight = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ height_cm: height ? Number(height) : null })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Altura salva");
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

  const trialEnd = sub.data?.trial_end ? new Date(sub.data.trial_end) : null;
  const periodEnd = sub.data?.current_period_end ? new Date(sub.data.current_period_end) : trialEnd;
  const daysLeft = periodEnd ? Math.max(0, Math.ceil((periodEnd.getTime() - Date.now()) / 86400000)) : 0;
  const subStatus = sub.data?.status === "active"
    ? `Ativa · ${daysLeft}d`
    : sub.data?.status === "trialing"
    ? `Trial · ${daysLeft}d`
    : "Inativa";

  return (
    <AppShell>
      <PageHeader kicker="Configuração" title="AJUSTES" />

      <section className="px-6 space-y-3 animate-slide-up [animation-delay:50ms]">
        <Link to="/subscription" className="bg-surface ring-1 ring-border p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <CreditCard className="size-4 text-primary" />
            <div>
              <p className="text-sm font-bold">Minha assinatura</p>
              <p className="text-[10px] font-mono uppercase text-muted">{subStatus}</p>
            </div>
          </div>
          <span className="text-xs text-muted">→</span>
        </Link>
        <Link to="/goals" className="bg-surface ring-1 ring-border p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Target className="size-4 text-primary" />
            <div>
              <p className="text-sm font-bold">Metas</p>
              <p className="text-[10px] font-mono uppercase text-muted">Calorias, macros, fibras</p>
            </div>
          </div>
          <span className="text-xs text-muted">→</span>
        </Link>
        <Link to="/history" className="bg-surface ring-1 ring-border p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BarChart3 className="size-4 text-primary" />
            <div>
              <p className="text-sm font-bold">Relatórios / Histórico</p>
              <p className="text-[10px] font-mono uppercase text-muted">Envio por email diário</p>
            </div>
          </div>
          <span className="text-xs text-muted">→</span>
        </Link>
      </section>

      <section className="px-6 mt-8 animate-slide-up [animation-delay:100ms]">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted mb-3">Perfil</h2>
        <div className="bg-surface ring-1 ring-border p-4 space-y-2">
          <label className="flex justify-between items-center gap-3">
            <span className="text-sm">Altura (cm)</span>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              onBlur={() => saveHeight.mutate()}
              className="w-24 bg-background ring-1 ring-border px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-primary"
            />
          </label>
          <p className="font-mono text-[10px] text-muted">Usado para cálculo de IMC no diário.</p>
        </div>
      </section>

      <section className="px-6 mt-8 animate-slide-up [animation-delay:150ms]">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted mb-3">Notificações</h2>
        <div className="bg-surface ring-1 ring-border p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {pushOn ? <Bell className="size-4 text-primary" /> : <BellOff className="size-4 text-muted" />}
            <div>
              <p className="text-sm font-bold">Push no celular/relógio</p>
              <p className="text-[10px] font-mono uppercase text-muted">
                {pushSupported() ? (pushOn ? "Ligado" : "Desligado") : "Não suportado"}
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
      </section>

      <section className="px-6 mt-10 animate-slide-up [animation-delay:200ms]">
        <button
          onClick={() => supabase.auth.signOut()}
          className="w-full bg-surface ring-1 ring-border p-4 flex items-center justify-center gap-2"
        >
          <LogOut className="size-4 text-muted" />
          <span className="text-xs font-mono uppercase">Sair</span>
        </button>
      </section>
    </AppShell>
  );
}
