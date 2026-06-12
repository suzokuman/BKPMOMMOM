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
import { dosesForDate, fmtHHMM } from "@/lib/meds-schedule";

export const Route = createFileRoute("/_authenticated/app")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const date = todayStr();
  const today = new Date();

  const q = useQuery({
    queryKey: ["dashboard", user!.id, date],
    queryFn: async () => {
      const [goal, meals, items, checks, medT, medC] = await Promise.all([
        supabase.from("nutrition_goals").select("*").eq("user_id", user!.id).maybeSingle(),
        supabase.from("meal_templates").select("*").order("alert_time"),
        supabase.from("meal_template_items").select("*"),
        supabase.from("meal_checks").select("*").eq("date", date),
        supabase.from("medication_templates").select("*").eq("active", true),
        supabase.from("medication_checks").select("*")
          .gte("scheduled_at", `${date}T00:00:00`)
          .lte("scheduled_at", `${date}T23:59:59`),
      ]);
      return {
        goal: goal.data,
        meals: meals.data ?? [],
        items: items.data ?? [],
        checks: checks.data ?? [],
        medT: medT.data ?? [],
        medC: medC.data ?? [],
      };
    },
  });

  const stats = useMemo(() => {
    const d = q.data;
    const checkedIds = new Set((d?.checks ?? []).map((c) => c.template_id));
    const consumed = (d?.items ?? [])
      .filter((i) => checkedIds.has(i.template_id))
      .reduce(
        (s, i) => ({
          kcal: s.kcal + Number(i.kcal),
          carbs: s.carbs + Number(i.carbs_g),
          fat: s.fat + Number(i.fat_g),
          protein: s.protein + Number(i.protein_g),
          fiber: s.fiber + Number(i.fiber_g),
        }),
        { kcal: 0, carbs: 0, fat: 0, protein: 0, fiber: 0 },
      );

    // expand meds for today
    const doses: { tplId: string; name: string; dose: string; at: Date; taken: boolean }[] = [];
    for (const t of d?.medT ?? []) {
      for (const at of dosesForDate(today, t)) {
        const check = (d?.medC ?? []).find(
          (c) => c.template_id === t.id && Math.abs(new Date(c.scheduled_at).getTime() - at.getTime()) < 60_000,
        );
        doses.push({
          tplId: t.id,
          name: t.name,
          dose: t.dose_text || (t.dose_mg ? `${t.dose_mg}mg` : ""),
          at,
          taken: !!check?.taken,
        });
      }
    }
    doses.sort((a, b) => a.at.getTime() - b.at.getTime());
    const medsDone = doses.filter((x) => x.taken).length;
    const nextMed = doses.find((x) => !x.taken && x.at >= new Date()) ?? doses.find((x) => !x.taken);

    return {
      consumed,
      goal: d?.goal,
      medsDone,
      medsTotal: doses.length,
      nextMed,
    };
  }, [q.data]);

  const tgKcal = Number(stats.goal?.target_kcal ?? 0);
  const tgProtein = Number(stats.goal?.target_protein_g ?? 0);

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
          percent={tgProtein ? (stats.consumed.protein / tgProtein) * 100 : 0}
          label="Proteína"
          value={tgProtein ? `${Math.round((stats.consumed.protein / tgProtein) * 100)}%` : "—"}
        />
        <Ring
          percent={tgKcal ? (stats.consumed.kcal / tgKcal) * 100 : 0}
          label="Calorias"
          value={tgKcal ? `${Math.round((stats.consumed.kcal / tgKcal) * 100)}%` : "—"}
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
                {stats.nextMed.dose && (
                  <p className="text-[10px] text-muted font-mono">{stats.nextMed.dose}</p>
                )}
              </div>
            </div>
            <span className="font-mono text-lg font-bold">{fmtHHMM(stats.nextMed.at)}</span>
          </Link>
        ) : (
          <div className="bg-surface ring-1 ring-border p-4 rounded-xl text-center">
            <p className="text-xs text-muted font-mono uppercase">Nenhuma dose pendente</p>
          </div>
        )}
      </section>

      <section className="px-6 mt-10 animate-slide-up [animation-delay:300ms] grid grid-cols-3 gap-2">
        <Link to="/diet" className="bg-surface ring-1 ring-border p-4 hover:bg-white/5 transition">
          <p className="font-mono text-[9px] uppercase text-muted">Kcal</p>
          <p className="font-display text-2xl mt-1">{Math.round(stats.consumed.kcal)}</p>
        </Link>
        <Link to="/diet" className="bg-surface ring-1 ring-border p-4 hover:bg-white/5 transition">
          <p className="font-mono text-[9px] uppercase text-muted">Prot</p>
          <p className="font-display text-2xl mt-1">
            {Math.round(stats.consumed.protein)}
            <span className="text-xs text-muted">g</span>
          </p>
        </Link>
        <Link to="/goals" className="bg-surface ring-1 ring-border p-4 hover:bg-white/5 transition">
          <p className="font-mono text-[9px] uppercase text-muted">Metas</p>
          <p className="font-display text-2xl mt-1">→</p>
        </Link>
      </section>

      <section className="px-6 mt-6 grid grid-cols-2 gap-2 animate-slide-up [animation-delay:350ms]">
        <Link to="/subscription" className="bg-surface ring-1 ring-border p-3 text-center">
          <p className="font-mono text-[9px] uppercase text-muted">Assinatura</p>
        </Link>
        <Link to="/settings" className="bg-surface ring-1 ring-border p-3 text-center">
          <p className="font-mono text-[9px] uppercase text-muted">Ajustes</p>
        </Link>
      </section>
    </AppShell>
  );
}
