import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, ChevronDown, ChevronUp, X, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { todayStr } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/diet")({
  component: DietPage,
});

function DietPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const date = todayStr();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [addingMeal, setAddingMeal] = useState(false);
  const [mealForm, setMealForm] = useState({ name: "", time: "" });

  const q = useQuery({
    queryKey: ["diet", user!.id, date],
    queryFn: async () => {
      const [meals, items, checks, goal] = await Promise.all([
        supabase.from("meal_templates").select("*").order("alert_time", { nullsFirst: false }),
        supabase.from("meal_template_items").select("*"),
        supabase.from("meal_checks").select("*").eq("date", date),
        supabase.from("nutrition_goals").select("*").eq("user_id", user!.id).maybeSingle(),
      ]);
      return {
        meals: meals.data ?? [],
        items: items.data ?? [],
        checks: checks.data ?? [],
        goal: goal.data,
      };
    },
  });

  const totals = useMemo(() => {
    const checkedIds = new Set((q.data?.checks ?? []).map((c) => c.template_id));
    return (q.data?.items ?? [])
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
  }, [q.data]);

  const goal = q.data?.goal;

  const addMeal = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("meal_templates").insert({
        user_id: user!.id,
        name: mealForm.name.trim(),
        alert_time: mealForm.time || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diet"] });
      setMealForm({ name: "", time: "" });
      setAddingMeal(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const delMeal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meal_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diet"] }),
  });

  const toggleCheck = useMutation({
    mutationFn: async (vars: { tplId: string; checked: boolean }) => {
      if (vars.checked) {
        const { error } = await supabase
          .from("meal_checks")
          .delete()
          .eq("template_id", vars.tplId)
          .eq("date", date);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("meal_checks")
          .insert({ user_id: user!.id, template_id: vars.tplId, date });
        if (error) throw error;
      }
    },
    onMutate: async (vars) => {
      // Compute new totals to check goal alerts
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["diet"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (!vars.checked) {
        // just got checked — compute new totals
        const items = (q.data?.items ?? []).filter((i) => i.template_id === vars.tplId);
        const newK = totals.kcal + items.reduce((s, i) => s + Number(i.kcal), 0);
        const newP = totals.protein + items.reduce((s, i) => s + Number(i.protein_g), 0);
        if (goal?.target_kcal && totals.kcal < Number(goal.target_kcal) && newK >= Number(goal.target_kcal))
          toast.success("🔥 Meta de calorias batida!");
        if (goal?.target_protein_g && totals.protein < Number(goal.target_protein_g) && newP >= Number(goal.target_protein_g))
          toast.success("💪 Meta de proteínas batida!");
      }
    },
  });

  function macroRow(label: string, v: number, t?: number | null) {
    const pct = t ? Math.min(100, (v / t) * 100) : 0;
    return (
      <div>
        <div className="flex justify-between font-mono text-[10px]">
          <span className="text-muted uppercase">{label}</span>
          <span>
            {Math.round(v)}
            <span className="text-muted">/{t ? Math.round(t) : "—"}</span>
          </span>
        </div>
        <div className="h-1 bg-border mt-1 relative">
          <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <header className="p-6 flex justify-between items-end animate-slide-up">
        <div>
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">Hoje</span>
          <h1 className="font-display text-4xl leading-none uppercase tracking-tight mt-1">
            MINHA<br />DIETA
          </h1>
        </div>
        <Link to="/goals" className="font-mono text-xs text-primary flex items-center gap-1">
          <Target className="size-3" /> meta
        </Link>
      </header>

      <section className="px-6 animate-slide-up [animation-delay:100ms]">
        <div className="bg-surface ring-1 ring-border p-5 space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="font-mono text-[10px] uppercase text-muted">Consumido</span>
            <span className="font-display text-3xl">
              {Math.round(totals.kcal)}
              <span className="text-xs text-muted">
                /{goal?.target_kcal ? Math.round(Number(goal.target_kcal)) : "—"} kcal
              </span>
            </span>
          </div>
          {macroRow("Carbo", totals.carbs, goal?.target_carbs_g ? Number(goal.target_carbs_g) : null)}
          {macroRow("Gord", totals.fat, goal?.target_fat_g ? Number(goal.target_fat_g) : null)}
          {macroRow("Prot", totals.protein, goal?.target_protein_g ? Number(goal.target_protein_g) : null)}
          {macroRow("Fibra", totals.fiber, goal?.target_fiber_g ? Number(goal.target_fiber_g) : null)}
        </div>
      </section>

      <section className="px-6 mt-6 animate-slide-up [animation-delay:200ms]">
        <h2 className="font-display text-xl uppercase tracking-tight mb-3">Refeições</h2>
        <div className="space-y-2">
          {(q.data?.meals ?? []).map((m) => {
            const items = (q.data?.items ?? []).filter((i) => i.template_id === m.id);
            const checked = (q.data?.checks ?? []).some((c) => c.template_id === m.id);
            const kcal = items.reduce((s, i) => s + Number(i.kcal), 0);
            return (
              <div key={m.id} className="bg-surface ring-1 ring-border">
                <div className="flex items-center p-3 gap-3">
                  <button
                    onClick={() => toggleCheck.mutate({ tplId: m.id, checked })}
                    className={`size-5 border flex items-center justify-center transition shrink-0 ${
                      checked ? "border-primary bg-primary/10" : "border-white/20"
                    }`}
                  >
                    {checked && <div className="size-2 bg-primary" />}
                  </button>
                  <button
                    onClick={() => setOpen({ ...open, [m.id]: !open[m.id] })}
                    className="flex-1 text-left"
                  >
                    <p className={`text-sm font-bold ${checked ? "" : ""}`}>{m.name}</p>
                    <p className="font-mono text-[10px] text-muted">
                      {m.alert_time ? m.alert_time.slice(0, 5) : "—"} · {items.length} item{items.length === 1 ? "" : "s"} · {Math.round(kcal)} kcal
                    </p>
                  </button>
                  <button onClick={() => setOpen({ ...open, [m.id]: !open[m.id] })}>
                    {open[m.id] ? <ChevronUp className="size-4 text-muted" /> : <ChevronDown className="size-4 text-muted" />}
                  </button>
                </div>
                {open[m.id] && (
                  <MealItems
                    mealId={m.id}
                    userId={user!.id}
                    items={items}
                    onDeleteMeal={() => delMeal.mutate(m.id)}
                  />
                )}
              </div>
            );
          })}
          {(q.data?.meals ?? []).length === 0 && !addingMeal && (
            <div className="text-center text-xs text-muted font-mono uppercase py-6">
              Crie sua primeira refeição
            </div>
          )}
        </div>

        {addingMeal ? (
          <div className="mt-3 bg-surface ring-1 ring-border p-4 space-y-2">
            <input
              value={mealForm.name}
              onChange={(e) => setMealForm({ ...mealForm, name: e.target.value })}
              placeholder="Nome (ex.: Jantar)"
              maxLength={80}
              className="w-full bg-background ring-1 ring-border px-3 py-2 text-sm focus:outline-none focus:ring-primary"
            />
            <input
              type="time"
              value={mealForm.time}
              onChange={(e) => setMealForm({ ...mealForm, time: e.target.value })}
              className="w-full bg-background ring-1 ring-border px-3 py-2 text-sm focus:outline-none focus:ring-primary"
            />
            <div className="flex gap-2">
              <button onClick={() => setAddingMeal(false)} className="flex-1 ring-1 ring-border py-2 font-mono text-xs uppercase tracking-widest">
                Cancelar
              </button>
              <button
                onClick={() => addMeal.mutate()}
                disabled={!mealForm.name.trim() || addMeal.isPending}
                className="flex-1 bg-primary text-primary-foreground py-2 font-display uppercase tracking-widest text-sm disabled:opacity-50"
              >
                Criar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingMeal(true)}
            className="w-full mt-4 bg-primary text-primary-foreground font-display text-lg py-3 uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <Plus className="size-5" /> Nova refeição
          </button>
        )}
      </section>
    </AppShell>
  );
}

function MealItems({
  mealId,
  userId,
  items,
  onDeleteMeal,
}: {
  mealId: string;
  userId: string;
  items: {
    id: string;
    name: string;
    qty: string | null;
    kcal: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    protein_g: number;
  }[];
  onDeleteMeal: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", qty: "", kcal: "", carbs: "", fat: "", fiber: "", protein: "" });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("meal_template_items").insert({
        template_id: mealId,
        user_id: userId,
        name: form.name.trim(),
        qty: form.qty || null,
        kcal: Number(form.kcal || 0),
        carbs_g: Number(form.carbs || 0),
        fat_g: Number(form.fat || 0),
        fiber_g: Number(form.fiber || 0),
        protein_g: Number(form.protein || 0),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diet"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setForm({ name: "", qty: "", kcal: "", carbs: "", fat: "", fiber: "", protein: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meal_template_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diet"] }),
  });

  return (
    <div className="border-t border-border p-3 space-y-2">
      {items.map((i) => (
        <div key={i.id} className="flex justify-between items-start text-xs">
          <div>
            <p className="text-sm">
              {i.name}
              {i.qty && <span className="text-muted"> · {i.qty}</span>}
            </p>
            <p className="font-mono text-[10px] text-muted">
              {Math.round(Number(i.kcal))} kcal · C {i.carbs_g}g · G {i.fat_g}g · F {i.fiber_g}g · P {i.protein_g}g
            </p>
          </div>
          <button onClick={() => del.mutate(i.id)} className="text-muted text-xs">✕</button>
        </div>
      ))}

      <div className="pt-2 space-y-2 border-t border-border/50">
        <div className="grid grid-cols-2 gap-2">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Alimento" className="bg-background ring-1 ring-border px-2 py-1.5 text-xs focus:outline-none focus:ring-primary col-span-2" />
          <input value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} placeholder="qtd (ex.: 100g)" className="bg-background ring-1 ring-border px-2 py-1.5 text-xs focus:outline-none focus:ring-primary col-span-2" />
          <input type="number" value={form.kcal} onChange={(e) => setForm({ ...form, kcal: e.target.value })} placeholder="kcal" className="bg-background ring-1 ring-border px-2 py-1.5 text-xs focus:outline-none focus:ring-primary" />
          <input type="number" value={form.carbs} onChange={(e) => setForm({ ...form, carbs: e.target.value })} placeholder="carbo" className="bg-background ring-1 ring-border px-2 py-1.5 text-xs focus:outline-none focus:ring-primary" />
          <input type="number" value={form.fat} onChange={(e) => setForm({ ...form, fat: e.target.value })} placeholder="gord" className="bg-background ring-1 ring-border px-2 py-1.5 text-xs focus:outline-none focus:ring-primary" />
          <input type="number" value={form.fiber} onChange={(e) => setForm({ ...form, fiber: e.target.value })} placeholder="fibra" className="bg-background ring-1 ring-border px-2 py-1.5 text-xs focus:outline-none focus:ring-primary" />
          <input type="number" value={form.protein} onChange={(e) => setForm({ ...form, protein: e.target.value })} placeholder="prot" className="bg-background ring-1 ring-border px-2 py-1.5 text-xs focus:outline-none focus:ring-primary col-span-2" />
        </div>
        <div className="flex gap-2">
          <button onClick={onDeleteMeal} className="flex-1 ring-1 ring-border py-1.5 font-mono text-[10px] uppercase tracking-widest flex items-center justify-center gap-1">
            <X className="size-3" /> Remover refeição
          </button>
          <button
            onClick={() => add.mutate()}
            disabled={!form.name.trim() || add.isPending}
            className="flex-1 bg-primary text-primary-foreground py-1.5 font-display uppercase tracking-widest text-xs disabled:opacity-50"
          >
            + Alimento
          </button>
        </div>
      </div>
    </div>
  );
}
