import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pill } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell, Ring } from "@/components/AppShell";
import { todayStr } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/app")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const date = todayStr();

  const q = useQuery({
    queryKey: ["dashboard", user!.id, date],
    queryFn: async () => {
      const [pg, pi, cg, ci, meds] = await Promise.all([
        supabase.from("daily_protein_goals").select("*").eq("date", date).maybeSingle(),
        supabase.from("protein_items").select("*").eq("date", date),
        supabase.from("daily_calorie_goals").select("*").eq("date", date).maybeSingle(),
        supabase.from("calorie_items").select("*").eq("date", date),
        supabase
          .from("medications")
          .select("*")
          .gte("scheduled_at", `${date}T00:00:00`)
          .lte("scheduled_at", `${date}T23:59:59`)
          .order("scheduled_at"),
      ]);
      return {
        proteinGoal: pg.data,
        proteinItems: pi.data ?? [],
        calorieGoal: cg.data,
        calorieItems: ci.data ?? [],
        meds: meds.data ?? [],
      };
    },
  });

  const stats = useMemo(() => {
    const d = q.data;
    const proteinDone = d?.proteinItems.filter((i) => i.checked).reduce((s, i) => s + Number(i.grams), 0) ?? 0;
    const proteinTarget = Number(d?.proteinGoal?.target_g ?? 0);
    const kcalDone = d?.calorieItems.filter((i) => i.checked).reduce((s, i) => s + Number(i.kcal), 0) ?? 0;
    const kcalTarget = Number(d?.calorieGoal?.target_kcal ?? 0);
    const medsDone = d?.meds.filter((m) => m.taken).length ?? 0;
    const medsTotal = d?.meds.length ?? 0;
    const nextMed = d?.meds.find((m) => !m.taken);
    return { proteinDone, proteinTarget, kcalDone, kcalTarget, medsDone, medsTotal, nextMed };
  }, [q.data]);

  return (
    <AppShell>
      <header className="p-6 flex justify-between items-end animate-slide-up">
        <div>
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}
          </span>
          <h1 className="font-display text-4xl leading-none uppercase tracking-tight mt-1">
            PRONTO<br />PARA O DIA?
          </h1>
        </div>
        <div className="size-10 bg-surface ring-1 ring-border rounded-full flex items-center justify-center">
          <div className="size-2 bg-primary rounded-full animate-pulse" />
        </div>
      </header>

      <section className="px-6 grid grid-cols-3 gap-3 animate-slide-up [animation-delay:100ms]">
        <Ring
          percent={stats.proteinTarget ? (stats.proteinDone / stats.proteinTarget) * 100 : 0}
          label="Proteína"
          value={
            stats.proteinTarget
              ? `${Math.round((stats.proteinDone / stats.proteinTarget) * 100)}%`
              : "—"
          }
        />
        <Ring
          percent={stats.kcalTarget ? (stats.kcalDone / stats.kcalTarget) * 100 : 0}
          label="Calorias"
          value={
            stats.kcalTarget
              ? `${Math.round((stats.kcalDone / stats.kcalTarget) * 100)}%`
              : "—"
          }
        />
        <Ring
          percent={stats.medsTotal ? (stats.medsDone / stats.medsTotal) * 100 : 0}
          label="Doses"
          value={stats.medsTotal ? `${stats.medsDone}/${stats.medsTotal}` : "—"}
        />
      </section>

      <section className="px-6 mt-8 animate-slide-up [animation-delay:200ms]">
        {stats.nextMed ? (
          <Link
            to="/medications"
            className="bg-surface ring-1 ring-border p-4 rounded-xl flex items-center justify-between"
          >
            <div className="flex gap-4 items-center">
              <div className="size-10 bg-white/5 rounded-lg flex items-center justify-center border border-white/10">
                <Pill className="size-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted font-mono uppercase">Próxima dose</p>
                <h3 className="font-bold text-sm">{stats.nextMed.name}</h3>
                <p className="text-[10px] text-muted font-mono">{stats.nextMed.dose_mg}mg</p>
              </div>
            </div>
            <span className="font-mono text-lg font-bold">
              {format(new Date(stats.nextMed.scheduled_at), "HH:mm")}
            </span>
          </Link>
        ) : (
          <div className="bg-surface ring-1 ring-border p-4 rounded-xl text-center">
            <p className="text-xs text-muted font-mono uppercase">Nenhuma dose pendente</p>
          </div>
        )}
      </section>

      <section className="px-6 mt-10 animate-slide-up [animation-delay:300ms] grid grid-cols-3 gap-2">
        <Link to="/protein" className="bg-surface ring-1 ring-border p-4 hover:bg-white/5 transition">
          <p className="font-mono text-[9px] uppercase text-muted">Proteína</p>
          <p className="font-display text-2xl mt-1">{Math.round(stats.proteinDone)}<span className="text-xs text-muted">g</span></p>
        </Link>
        <Link to="/calories" className="bg-surface ring-1 ring-border p-4 hover:bg-white/5 transition">
          <p className="font-mono text-[9px] uppercase text-muted">Kcal</p>
          <p className="font-display text-2xl mt-1">{Math.round(stats.kcalDone)}</p>
        </Link>
        <Link to="/medications" className="bg-surface ring-1 ring-border p-4 hover:bg-white/5 transition">
          <p className="font-mono text-[9px] uppercase text-muted">Doses</p>
          <p className="font-display text-2xl mt-1">{stats.medsDone}<span className="text-xs text-muted">/{stats.medsTotal}</span></p>
        </Link>
      </section>

      <section className="px-6 mt-8 animate-slide-up [animation-delay:400ms]">
        <button
          onClick={() => supabase.auth.signOut()}
          className="w-full text-[10px] font-mono uppercase tracking-widest text-muted hover:text-foreground py-2"
        >
          Sair
        </button>
      </section>
    </AppShell>
  );
}
