import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell, PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/goals")({
  component: GoalsPage,
});

function GoalsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ kcal: "", carbs: "", fat: "", protein: "", fiber: "" });

  const q = useQuery({
    queryKey: ["nutrition_goals", user!.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("nutrition_goals")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (q.data) {
      setForm({
        kcal: q.data.target_kcal ? String(q.data.target_kcal) : "",
        carbs: q.data.target_carbs_g ? String(q.data.target_carbs_g) : "",
        fat: q.data.target_fat_g ? String(q.data.target_fat_g) : "",
        protein: q.data.target_protein_g ? String(q.data.target_protein_g) : "",
        fiber: q.data.target_fiber_g ? String(q.data.target_fiber_g) : "",
      });
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("nutrition_goals").upsert({
        user_id: user!.id,
        target_kcal: form.kcal ? Number(form.kcal) : null,
        target_carbs_g: form.carbs ? Number(form.carbs) : null,
        target_fat_g: form.fat ? Number(form.fat) : null,
        target_protein_g: form.protein ? Number(form.protein) : null,
        target_fiber_g: form.fiber ? Number(form.fiber) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition_goals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Metas salvas");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <AppShell>
      <PageHeader kicker="Diárias" title="META" />
      <section className="px-6 space-y-4 animate-slide-up [animation-delay:100ms]">
        <Field label="Calorias (kcal)" value={form.kcal} onChange={(v) => setForm({ ...form, kcal: v })} />
        <Field label="Carboidratos (g)" value={form.carbs} onChange={(v) => setForm({ ...form, carbs: v })} />
        <Field label="Gorduras (g)" value={form.fat} onChange={(v) => setForm({ ...form, fat: v })} />
        <Field label="Proteínas (g)" value={form.protein} onChange={(v) => setForm({ ...form, protein: v })} />
        <Field label="Fibras (g)" value={form.fiber} onChange={(v) => setForm({ ...form, fiber: v })} />

        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="w-full bg-primary text-primary-foreground font-display text-lg py-3 uppercase tracking-widest disabled:opacity-50"
        >
          Salvar metas
        </button>
        <Link
          to="/diet"
          className="block text-center text-xs font-mono uppercase text-muted py-3"
        >
          Voltar para Dieta
        </Link>
      </section>
    </AppShell>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="bg-surface ring-1 ring-border p-4 flex flex-col">
      <span className="font-mono text-[10px] uppercase text-muted tracking-widest">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-2xl font-display mt-1 focus:outline-none"
        placeholder="—"
      />
    </label>
  );
}
