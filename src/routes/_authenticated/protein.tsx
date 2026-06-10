import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { todayStr } from "@/lib/date";

export const Route = createFileRoute("/_authenticated/protein")({
  component: ProteinPage,
});

function ProteinPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const date = todayStr();
  const [adding, setAdding] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [name, setName] = useState("");
  const [grams, setGrams] = useState("");
  const [goal, setGoal] = useState("");

  const q = useQuery({
    queryKey: ["protein", user!.id, date],
    queryFn: async () => {
      const [pg, pi] = await Promise.all([
        supabase.from("daily_protein_goals").select("*").eq("date", date).maybeSingle(),
        supabase.from("protein_items").select("*").eq("date", date).order("created_at"),
      ]);
      return { goal: pg.data, items: pi.data ?? [] };
    },
  });

  useEffect(() => {
    if (q.data?.goal) setGoal(String(q.data.goal.target_g));
  }, [q.data?.goal]);

  const consumed = q.data?.items.filter((i) => i.checked).reduce((s, i) => s + Number(i.grams), 0) ?? 0;
  const target = Number(q.data?.goal?.target_g ?? 0);
  const pct = target ? Math.min(100, (consumed / target) * 100) : 0;

  const saveGoal = useMutation({
    mutationFn: async (g: number) => {
      const { error } = await supabase
        .from("daily_protein_goals")
        .upsert({ user_id: user!.id, date, target_g: g });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["protein"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setEditingGoal(false);
      toast.success("Meta salva");
    },
    onError: (e) => toast.error(e.message),
  });

  const addItem = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("protein_items").insert({
        user_id: user!.id,
        date,
        name: name.trim(),
        grams: Number(grams),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["protein"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setName("");
      setGrams("");
      setAdding(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (i: { id: string; checked: boolean }) => {
      const { error } = await supabase
        .from("protein_items")
        .update({ checked: !i.checked })
        .eq("id", i.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["protein"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      // detect goal reached
      const items = q.data?.items ?? [];
      const after = items
        .map((i) => (i.id === vars.id ? { ...i, checked: !i.checked } : i))
        .filter((i) => i.checked)
        .reduce((s, i) => s + Number(i.grams), 0);
      if (target && after >= target && consumed < target) {
        toast.success("🔥 Meta proteica batida!");
      }
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("protein_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["protein"] }),
  });

  return (
    <AppShell>
      <header className="p-6 animate-slide-up">
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">Hoje</span>
        <h1 className="font-display text-4xl leading-none uppercase tracking-tight mt-1">
          META<br />PROTEICA
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
              {target ? `${target}g` : "definir meta"}
            </button>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-5xl">{Math.round(consumed)}</span>
            <span className="font-mono text-sm text-muted">g de {target || "—"}g</span>
          </div>
          <div className="h-2 bg-border mt-4 relative overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          {editingGoal && (
            <div className="mt-4 flex gap-2">
              <input
                type="number"
                min="1"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="ex: 180"
                className="flex-1 bg-background ring-1 ring-border px-3 py-2 text-sm focus:outline-none focus:ring-primary"
              />
              <button
                onClick={() => saveGoal.mutate(Number(goal))}
                disabled={!goal || saveGoal.isPending}
                className="bg-primary text-primary-foreground font-display px-4 uppercase tracking-widest text-sm"
              >
                OK
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="px-6 mt-6 animate-slide-up [animation-delay:200ms]">
        <div className="flex justify-between items-end mb-3">
          <h2 className="font-display text-xl uppercase tracking-tight">Itens</h2>
          <span className="font-mono text-[10px] text-muted">
            {q.data?.items.length ?? 0} registrados
          </span>
        </div>

        <div className="space-y-2">
          {(q.data?.items ?? []).map((i) => (
            <div
              key={i.id}
              className="bg-surface p-4 ring-1 ring-border flex justify-between items-center"
            >
              <button
                onClick={() => toggle.mutate({ id: i.id, checked: i.checked })}
                className="flex gap-3 items-center flex-1 text-left"
              >
                <div
                  className={`size-5 border flex items-center justify-center transition ${
                    i.checked ? "border-primary bg-primary/10" : "border-white/20"
                  }`}
                >
                  {i.checked && <div className="size-2 bg-primary" />}
                </div>
                <span className={`text-sm ${i.checked ? "" : "text-muted"}`}>{i.name}</span>
              </button>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted">{i.grams}g</span>
                <button
                  onClick={() => del.mutate(i.id)}
                  className="text-muted hover:text-foreground text-xs font-mono"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          {(q.data?.items ?? []).length === 0 && !adding && (
            <div className="text-center text-xs text-muted font-mono uppercase py-6">
              Sem itens hoje
            </div>
          )}
        </div>

        {adding ? (
          <div className="mt-3 bg-surface ring-1 ring-border p-4 space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Item (ex: Frango grelhado)"
              maxLength={80}
              className="w-full bg-background ring-1 ring-border px-3 py-2 text-sm focus:outline-none focus:ring-primary"
            />
            <input
              type="number"
              min="0"
              step="0.1"
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              placeholder="Proteína (g)"
              className="w-full bg-background ring-1 ring-border px-3 py-2 text-sm focus:outline-none focus:ring-primary"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setAdding(false)}
                className="flex-1 ring-1 ring-border py-2 font-mono text-xs uppercase tracking-widest"
              >
                Cancelar
              </button>
              <button
                onClick={() => addItem.mutate()}
                disabled={!name.trim() || !grams || addItem.isPending}
                className="flex-1 bg-primary text-primary-foreground py-2 font-display uppercase tracking-widest text-sm disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full mt-4 bg-primary text-primary-foreground font-display text-lg py-3 uppercase tracking-widest active:translate-y-0.5 transition flex items-center justify-center gap-2"
          >
            <Plus className="size-5" /> Adicionar item
          </button>
        )}
      </section>
    </AppShell>
  );
}
