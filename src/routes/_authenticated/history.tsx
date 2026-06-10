import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { todayStr } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const { user } = useAuth();
  const from = todayStr(subDays(new Date(), 13));

  const q = useQuery({
    queryKey: ["history", user!.id, from],
    queryFn: async () => {
      const [pg, pi, cg, ci, meds] = await Promise.all([
        supabase.from("daily_protein_goals").select("*").gte("date", from),
        supabase.from("protein_items").select("*").gte("date", from).eq("checked", true),
        supabase.from("daily_calorie_goals").select("*").gte("date", from),
        supabase.from("calorie_items").select("*").gte("date", from).eq("checked", true),
        supabase.from("medications").select("*").gte("scheduled_at", `${from}T00:00:00`),
      ]);
      return {
        proteinGoals: pg.data ?? [],
        proteinItems: pi.data ?? [],
        calorieGoals: cg.data ?? [],
        calorieItems: ci.data ?? [],
        meds: meds.data ?? [],
      };
    },
  });

  const days = Array.from({ length: 14 }, (_, i) => todayStr(subDays(new Date(), 13 - i)));

  function summary(d: string) {
    const pgT = Number(q.data?.proteinGoals.find((g) => g.date === d)?.target_g ?? 0);
    const pSum = (q.data?.proteinItems ?? [])
      .filter((i) => i.date === d)
      .reduce((s, i) => s + Number(i.grams), 0);
    const cgT = Number(q.data?.calorieGoals.find((g) => g.date === d)?.target_kcal ?? 0);
    const cSum = (q.data?.calorieItems ?? [])
      .filter((i) => i.date === d)
      .reduce((s, i) => s + Number(i.kcal), 0);
    const dayMeds = (q.data?.meds ?? []).filter((m) =>
      m.scheduled_at.startsWith(d),
    );
    const medsTaken = dayMeds.filter((m) => m.taken).length;
    return { pgT, pSum, cgT, cSum, medsTaken, medsTotal: dayMeds.length };
  }

  return (
    <AppShell>
      <header className="p-6 animate-slide-up">
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">14 dias</span>
        <h1 className="font-display text-4xl leading-none uppercase tracking-tight mt-1">
          HISTÓRICO
        </h1>
      </header>

      <section className="px-6 space-y-6 animate-slide-up [animation-delay:100ms]">
        {/* Protein bar chart */}
        <Card title="Proteína" unit="g">
          <BarChart
            data={days.map((d) => {
              const s = summary(d);
              return { day: d, value: s.pSum, target: s.pgT };
            })}
          />
        </Card>

        <Card title="Calorias" unit="kcal">
          <BarChart
            data={days.map((d) => {
              const s = summary(d);
              return { day: d, value: s.cSum, target: s.cgT };
            })}
          />
        </Card>

        <Card title="Medicação" unit="doses">
          <div className="space-y-1.5 mt-3">
            {days.slice().reverse().map((d) => {
              const s = summary(d);
              const pct = s.medsTotal ? (s.medsTaken / s.medsTotal) * 100 : 0;
              return (
                <div key={d} className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-muted w-16">
                    {format(new Date(d + "T12:00"), "dd MMM", { locale: ptBR })}
                  </span>
                  <div className="flex-1 h-2 bg-border relative">
                    <div
                      className="absolute inset-y-0 left-0 bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-muted w-10 text-right">
                    {s.medsTaken}/{s.medsTotal}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </section>
    </AppShell>
  );
}

function Card({ title, unit, children }: { title: string; unit: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface ring-1 ring-border p-5">
      <div className="flex justify-between items-baseline">
        <h2 className="font-display text-xl uppercase tracking-tight">{title}</h2>
        <span className="font-mono text-[10px] text-muted uppercase tracking-widest">{unit}</span>
      </div>
      {children}
    </div>
  );
}

function BarChart({ data }: { data: { day: string; value: number; target: number }[] }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.target)));
  return (
    <div className="mt-4 flex items-end justify-between h-24 gap-1">
      {data.map((d) => {
        const h = (d.value / max) * 100;
        const hit = d.target && d.value >= d.target;
        return (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full h-20 flex items-end">
              <div
                className={`w-full transition-all ${hit ? "bg-primary" : "bg-muted/40"}`}
                style={{ height: `${h}%`, minHeight: d.value > 0 ? "2px" : "0" }}
              />
            </div>
            <span className="font-mono text-[8px] text-muted">
              {format(new Date(d.day + "T12:00"), "dd")}
            </span>
          </div>
        );
      })}
    </div>
  );
}
