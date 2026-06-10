import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { todayStr } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/calories")({
  component: CaloriesPage,
});

function CaloriesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const date = todayStr();
  const [adding, setAdding] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [form, setForm] = useState({ name: "", kcal: "", carbs: "", fat: "", protein: "" });
  const [goalForm, setGoalForm] = useState({ kcal: "", carbs: "", fat: "", protein: "" });

  const q = useQuery({
    queryKey: ["calories", user!.id, date],
    queryFn: async () => {
      const [cg, ci] = await Promise.all([
        supabase.from("daily_calorie_goals").select("*").eq("date", date).maybeSingle(),
        supabase.from("calorie_items").select("*").eq("date", date).order("created_at"),
      ]);
      return { goal: cg.data, items: ci.data ?? [] };
    },
  });

  useEffect(() => {
    if (q.data?.goal) {
      setGoalForm({
        kcal: String(q.data.goal.target_kcal),
        carbs: q.data.goal.target_carbs_g ? String(q.data.goal.target_carbs_g) : "",
        fat: q.data.goal.target_fat_g ? String(q.data.goal.target_fat_g) : "",
        protein: q.data.goal.target_protein_g ? String(q.data.goal.target_protein_g) : "",
      });
    }
  }, [q.data?.goal]);

  const totals = (q.data?.items ?? [])
    .filter((i) => i.checked)
    .reduce(
      (s, i) => ({
        kcal: s.kcal + Number(i.kcal),
        carbs: s.carbs + Number(i.carbs_g),
        fat: s.fat + Number(i.fat_g),
        protein: s.protein + Number(i.protein_g),
      }),
      { kcal: 0, carbs: 0, fat: 0, protein: 0 },
    );

  const target = Number(q.data?.goal?.target_kcal ?? 0);
  const pct = target ? Math.min(100, (totals.kcal / target) * 100) : 0;

  const saveGoal = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("daily_calorie_goals").upsert({
        user_id: user!.id,
        date,
        target_kcal: Number(goalForm.kcal),
        target_carbs_g: goalForm.carbs ? Number(goalForm.carbs) : null,
        target_fat_g: goalForm.fat ? Number(goalForm.fat) : null,
        target_protein_g: goalForm.protein ? Number(goalForm.protein) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calories"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setEditingGoal(false);
      toast.success("Meta salva");
    },
    onError: (e) => toast.error(e.message),
  });

  const addItem = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("calorie_items").insert({
        user_id: user!.id,
        date,
        name: form.name.trim(),
        kcal: Number(form.kcal || 0),
        carbs_g: Number(form.carbs || 0),
        fat_g: Number(form.fat || 0),
        protein_g: Number(form.protein || 0),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calories"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setForm({ name: "", kcal: "", carbs: "", fat: "", protein: "" });
      setAdding(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (i: { id: string; checked: boolean; kcal: number }) => {
      const { error } = await supabase
        .from("calorie_items")
        .update({ checked: !i.checked })
        .eq("id", i.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["calories"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      const items = q.data?.items ?? [];
      const after = items
        .map((i) => (i.id === vars.id ? { ...i, checked: !i.checked } : i))
        .filter((i) => i.checked)
        .reduce((s, i) => s + Number(i.kcal), 0);
      if (target && after >= target && totals.kcal < target) {
        toast.success("🔥 Meta calórica batida!");
      }
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("calorie_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calories"] }),
  });

  return (
    <AppShell>
      <header className="p-6 animate-slide-up">
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">Hoje</span>
        <h1 className="font-display text-4xl leading-none uppercase tracking-tight mt-1">
          META<br />CALÓRICA
        </h1>
      </header>

      <section className="px-6 animate-slide-up [animation-delay:100ms]">
        <div className="bg-surface ring-1 ring-border p-5">
          <div className="flex justify-between items-baseline mb-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
              Consumido
            </span>
            <button
              onClick={() => setEditingGoal(!editingGoal)}
              className="font-mono text-xs text-primary flex items-center gap-1"
            >
              <Target className="size-3" />
              {target ? `${target} kcal` : "definir meta"}
            </button>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-5xl">{Math.round(totals.kcal)}</span>
            <span className="font-mono text-sm text-muted">kcal de {target || "—"}</span>
          </div>
          <div className="h-2 bg-border mt-4 relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 pt-3 border-t border-border">
            {[
              { l: "Carbo", v: totals.carbs, t: q.data?.goal?.target_carbs_g },
              { l: "Gord", v: totals.fat, t: q.data?.goal?.target_fat_g },
              { l: "Prot", v: totals.protein, t: q.data?.goal?.target_protein_g },
            ].map((m) => (
              <div key={m.l}>
                <p className="font-mono text-[9px] uppercase text-muted tracking-widest">{m.l}</p>
                <p className="font-display text-lg">
                  {Math.round(m.v)}
                  <span className="text-xs text-muted">/{m.t ? Math.round(Number(m.t)) : "—"}g</span>
                </p>
              </div>
            ))}
          </div>
          {editingGoal && (
            <div className="mt-4 space-y-2 pt-4 border-t border-border">
              <input type="number" value={goalForm.kcal} onChange={(e) => setGoalForm({ ...goalForm, kcal: e.target.value })} placeholder="kcal*" className="w-full bg-background ring-1 ring-border px-3 py-2 text-sm focus:outline-none focus:ring-primary" />
              <div className="grid grid-cols-3 gap-2">
                <input type="number" value={goalForm.carbs} onChange={(e) => setGoalForm({ ...goalForm, carbs: e.target.value })} placeholder="carbo g" className="bg-background ring-1 ring-border px-2 py-2 text-sm focus:outline-none focus:ring-primary" />
                <input type="number" value={goalForm.fat} onChange={(e) => setGoalForm({ ...goalForm, fat: e.target.value })} placeholder="gord g" className="bg-background ring-1 ring-border px-2 py-2 text-sm focus:outline-none focus:ring-primary" />
                <input type="number" value={goalForm.protein} onChange={(e) => setGoalForm({ ...goalForm, protein: e.target.value })} placeholder="prot g" className="bg-background ring-1 ring-border px-2 py-2 text-sm focus:outline-none focus:ring-primary" />
              </div>
              <button onClick={() => saveGoal.mutate()} disabled={!goalForm.kcal || saveGoal.isPending} className="w-full bg-primary text-primary-foreground font-display py-2 uppercase tracking-widest text-sm">Salvar</button>
            </div>
          )}
        </div>
      </section>

      <section className="px-6 mt-6 animate-slide-up [animation-delay:200ms]">
        <h2 className="font-display text-xl uppercase tracking-tight mb-3">Refeições</h2>
        <div className="space-y-2">
          {(q.data?.items ?? []).map((i) => (
            <div key={i.id} className="bg-surface p-4 ring-1 ring-border">
              <div className="flex justify-between items-start">
                <button onClick={() => toggle.mutate({ id: i.id, checked: i.checked, kcal: Number(i.kcal) })} className="flex gap-3 items-center flex-1 text-left">
                  <div className={`size-5 border flex items-center justify-center transition ${i.checked ? "border-primary bg-primary/10" : "border-white/20"}`}>
                    {i.checked && <div className="size-2 bg-primary" />}
                  </div>
                  <div>
                    <p className={`text-sm ${i.checked ? "" : "text-muted"}`}>{i.name}</p>
                    <p className="font-mono text-[10px] text-muted mt-0.5">
                      C {i.carbs_g}g · G {i.fat_g}g · P {i.protein_g}g
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs">{i.kcal} kcal</span>
                  <button onClick={() => del.mutate(i.id)} className="text-muted text-xs">✕</button>
                </div>
              </div>
            </div>
          ))}
          {(q.data?.items ?? []).length === 0 && !adding && (
            <div className="text-center text-xs text-muted font-mono uppercase py-6">Sem refeições</div>
          )}
        </div>

        {adding ? (
          <div className="mt-3 bg-surface ring-1 ring-border p-4 space-y-2">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} placeholder="Refeição" className="w-full bg-background ring-1 ring-border px-3 py-2 text-sm focus:outline-none focus:ring-primary" />
            <input type="number" value={form.kcal} onChange={(e) => setForm({ ...form, kcal: e.target.value })} placeholder="kcal*" className="w-full bg-background ring-1 ring-border px-3 py-2 text-sm focus:outline-none focus:ring-primary" />
            <div className="grid grid-cols-3 gap-2">
              <input type="number" value={form.carbs} onChange={(e) => setForm({ ...form, carbs: e.target.value })} placeholder="carbo" className="bg-background ring-1 ring-border px-2 py-2 text-sm focus:outline-none focus:ring-primary" />
              <input type="number" value={form.fat} onChange={(e) => setForm({ ...form, fat: e.target.value })} placeholder="gord" className="bg-background ring-1 ring-border px-2 py-2 text-sm focus:outline-none focus:ring-primary" />
              <input type="number" value={form.protein} onChange={(e) => setForm({ ...form, protein: e.target.value })} placeholder="prot" className="bg-background ring-1 ring-border px-2 py-2 text-sm focus:outline-none focus:ring-primary" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAdding(false)} className="flex-1 ring-1 ring-border py-2 font-mono text-xs uppercase tracking-widest">Cancelar</button>
              <button onClick={() => addItem.mutate()} disabled={!form.name.trim() || !form.kcal || addItem.isPending} className="flex-1 bg-primary text-primary-foreground py-2 font-display uppercase tracking-widest text-sm disabled:opacity-50">Adicionar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="w-full mt-4 bg-primary text-primary-foreground font-display text-lg py-3 uppercase tracking-widest active:translate-y-0.5 transition flex items-center justify-center gap-2">
            <Plus className="size-5" /> Adicionar refeição
          </button>
        )}
      </section>
    </AppShell>
  );
}
