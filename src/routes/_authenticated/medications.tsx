import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/medications")({
  component: MedicationsPage,
});

function MedicationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const defaultDateTime = format(new Date(today.getTime() - today.getTimezoneOffset() * 60000), "yyyy-MM-dd'T'HH:mm");
  const [form, setForm] = useState({ name: "", dose: "", when: defaultDateTime });

  const q = useQuery({
    queryKey: ["meds", user!.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medications")
        .select("*")
        .gte("scheduled_at", todayStart)
        .order("scheduled_at");
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("medications").insert({
        user_id: user!.id,
        name: form.name.trim(),
        dose_mg: Number(form.dose),
        scheduled_at: new Date(form.when).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meds"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setForm({ name: "", dose: "", when: defaultDateTime });
      setAdding(false);
      toast.success("Dose agendada");
    },
    onError: (e) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (m: { id: string; taken: boolean }) => {
      const { error } = await supabase
        .from("medications")
        .update({ taken: !m.taken, taken_at: !m.taken ? new Date().toISOString() : null })
        .eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["meds"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (!vars.taken) toast.success("Dose registrada ✓");
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("medications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meds"] }),
  });

  return (
    <AppShell>
      <header className="p-6 animate-slide-up">
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">Cronograma</span>
        <h1 className="font-display text-4xl leading-none uppercase tracking-tight mt-1">
          MEDICAÇÃO
        </h1>
      </header>

      <section className="px-6 animate-slide-up [animation-delay:100ms]">
        <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-border">
          {(q.data ?? []).map((m) => (
            <div key={m.id} className="relative pl-10">
              <button
                onClick={() => toggle.mutate({ id: m.id, taken: m.taken })}
                className={`absolute left-1.5 top-1 size-3 rounded-full ring-4 ring-background ${
                  m.taken ? "bg-primary" : "bg-border"
                }`}
                aria-label="marcar"
              />
              <div className="flex justify-between items-start">
                <div>
                  <p className={`text-sm font-bold ${m.taken ? "text-muted line-through" : ""}`}>
                    {m.name}
                  </p>
                  <p className="text-xs text-muted font-mono">
                    {format(new Date(m.scheduled_at), "dd/MM HH:mm")} · {m.dose_mg}mg
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded ${
                      m.taken ? "bg-primary/20 text-primary" : "text-muted"
                    }`}
                  >
                    {m.taken ? "OK" : "Pendente"}
                  </span>
                  <button onClick={() => del.mutate(m.id)} className="text-muted text-xs">
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
          {(q.data ?? []).length === 0 && !adding && (
            <div className="text-center text-xs text-muted font-mono uppercase py-6 pl-10">
              Nenhuma dose agendada
            </div>
          )}
        </div>

        {adding ? (
          <div className="mt-6 bg-surface ring-1 ring-border p-4 space-y-2">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Medicação"
              maxLength={80}
              className="w-full bg-background ring-1 ring-border px-3 py-2 text-sm focus:outline-none focus:ring-primary"
            />
            <input
              type="number"
              value={form.dose}
              onChange={(e) => setForm({ ...form, dose: e.target.value })}
              placeholder="Dose (mg)"
              min="0"
              step="0.1"
              className="w-full bg-background ring-1 ring-border px-3 py-2 text-sm focus:outline-none focus:ring-primary"
            />
            <input
              type="datetime-local"
              value={form.when}
              onChange={(e) => setForm({ ...form, when: e.target.value })}
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
                onClick={() => add.mutate()}
                disabled={!form.name.trim() || !form.dose || !form.when || add.isPending}
                className="flex-1 bg-primary text-primary-foreground py-2 font-display uppercase tracking-widest text-sm disabled:opacity-50"
              >
                Agendar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full mt-6 bg-primary text-primary-foreground font-display text-lg py-3 uppercase tracking-widest active:translate-y-0.5 transition flex items-center justify-center gap-2"
          >
            <Plus className="size-5" /> Agendar dose
          </button>
        )}
      </section>
    </AppShell>
  );
}
