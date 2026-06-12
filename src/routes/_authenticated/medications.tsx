import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { dosesForDate, fmtHHMM, FREQUENCY_OPTIONS } from "@/lib/meds-schedule";

export const Route = createFileRoute("/_authenticated/medications")({
  component: MedicationsPage,
});

function MedicationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = useMemo(() => new Date(), []);
  const dayStart = new Date(today); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(today); dayEnd.setHours(23, 59, 59, 999);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: "",
    dose: "",
    time: "08:00",
    frequency: "daily",
    custom_at: "",
  });

  const q = useQuery({
    queryKey: ["meds", user!.id, dayStart.toISOString()],
    queryFn: async () => {
      const [tpls, checks] = await Promise.all([
        supabase.from("medication_templates").select("*").eq("active", true).order("start_time"),
        supabase.from("medication_checks").select("*")
          .gte("scheduled_at", dayStart.toISOString())
          .lte("scheduled_at", dayEnd.toISOString()),
      ]);
      return { tpls: tpls.data ?? [], checks: checks.data ?? [] };
    },
  });

  const doses = useMemo(() => {
    const out: { tplId: string; name: string; dose: string; at: Date; checked?: { id: string; taken: boolean } }[] = [];
    for (const t of q.data?.tpls ?? []) {
      for (const at of dosesForDate(today, t)) {
        const check = (q.data?.checks ?? []).find(
          (c) => c.template_id === t.id && Math.abs(new Date(c.scheduled_at).getTime() - at.getTime()) < 60_000,
        );
        out.push({
          tplId: t.id,
          name: t.name,
          dose: t.dose_text || (t.dose_mg ? `${t.dose_mg}mg` : ""),
          at,
          checked: check ? { id: check.id, taken: check.taken } : undefined,
        });
      }
    }
    return out.sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [q.data, today]);

  const addTpl = useMutation({
    mutationFn: async () => {
      const payload: {
        user_id: string;
        name: string;
        dose_mg: number | null;
        frequency: string;
        start_time: string | null;
        custom_at: string | null;
      } = {
        user_id: user!.id,
        name: form.name.trim(),
        dose_mg: form.dose ? Number(form.dose) : null,
        frequency: form.frequency,
        start_time: form.frequency === "custom" ? null : form.time,
        custom_at: form.frequency === "custom" ? new Date(form.custom_at).toISOString() : null,
      };
      const { error } = await supabase.from("medication_templates").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meds"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setForm({ name: "", dose: "", time: "08:00", frequency: "daily", custom_at: "" });
      setAdding(false);
      toast.success("Medicação criada");
    },
    onError: (e) => toast.error(e.message),
  });

  const delTpl = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("medication_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meds"] }),
  });

  const toggleDose = useMutation({
    mutationFn: async (vars: { tplId: string; at: Date; checked?: { id: string; taken: boolean } }) => {
      if (vars.checked) {
        const { error } = await supabase
          .from("medication_checks")
          .update({ taken: !vars.checked.taken, taken_at: !vars.checked.taken ? new Date().toISOString() : null })
          .eq("id", vars.checked.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("medication_checks").insert({
          user_id: user!.id,
          template_id: vars.tplId,
          scheduled_at: vars.at.toISOString(),
          taken: true,
          taken_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meds"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return (
    <AppShell>
      <header className="p-6 animate-slide-up">
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">Hoje</span>
        <h1 className="font-display text-4xl leading-none uppercase tracking-tight mt-1">MEDICAÇÃO</h1>
      </header>

      <section className="px-6 animate-slide-up [animation-delay:100ms]">
        <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-border">
          {doses.map((d, i) => {
            const taken = !!d.checked?.taken;
            return (
              <div key={`${d.tplId}-${i}`} className="relative pl-10">
                <button
                  onClick={() => toggleDose.mutate({ tplId: d.tplId, at: d.at, checked: d.checked })}
                  className={`absolute left-1.5 top-1 size-3 rounded-full ring-4 ring-background ${
                    taken ? "bg-primary" : "bg-border"
                  }`}
                  aria-label="marcar"
                />
                <div className="flex justify-between items-start">
                  <div>
                    <p className={`text-sm font-bold ${taken ? "text-muted line-through" : ""}`}>{d.name}</p>
                    <p className="text-xs text-muted font-mono">
                      {fmtHHMM(d.at)} {d.dose && `· ${d.dose}`}
                    </p>
                  </div>
                  <span
                    className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded ${
                      taken ? "bg-primary/20 text-primary" : "text-muted"
                    }`}
                  >
                    {taken ? "OK" : "Pendente"}
                  </span>
                </div>
              </div>
            );
          })}
          {doses.length === 0 && !adding && (
            <div className="text-center text-xs text-muted font-mono uppercase py-6 pl-10">
              Nenhum medicamento ativo
            </div>
          )}
        </div>

        <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted mt-8 mb-2">
          Medicamentos ativos
        </h2>
        <div className="space-y-1">
          {(q.data?.tpls ?? []).map((t) => (
            <div key={t.id} className="bg-surface ring-1 ring-border px-3 py-2 flex justify-between items-center">
              <div>
                <p className="text-xs">{t.name} {t.dose_mg && <span className="text-muted">· {t.dose_mg}mg</span>}</p>
                <p className="font-mono text-[9px] text-muted">
                  {FREQUENCY_OPTIONS.find((o) => o.value === t.frequency)?.label}
                  {t.start_time && ` · ${t.start_time.slice(0, 5)}`}
                </p>
              </div>
              <button onClick={() => delTpl.mutate(t.id)} className="text-muted text-xs">✕</button>
            </div>
          ))}
        </div>

        {adding ? (
          <div className="mt-6 bg-surface ring-1 ring-border p-4 space-y-2">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nome (ex.: Vitamina D)"
              maxLength={80}
              className="w-full bg-background ring-1 ring-border px-3 py-2 text-sm focus:outline-none focus:ring-primary"
            />
            <input
              type="number"
              value={form.dose}
              onChange={(e) => setForm({ ...form, dose: e.target.value })}
              placeholder="Dose (mg)"
              step="0.1"
              className="w-full bg-background ring-1 ring-border px-3 py-2 text-sm focus:outline-none focus:ring-primary"
            />
            <select
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value })}
              className="w-full bg-background ring-1 ring-border px-3 py-2 text-sm focus:outline-none focus:ring-primary"
            >
              {FREQUENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {form.frequency === "custom" ? (
              <input
                type="datetime-local"
                value={form.custom_at}
                onChange={(e) => setForm({ ...form, custom_at: e.target.value })}
                className="w-full bg-background ring-1 ring-border px-3 py-2 text-sm focus:outline-none focus:ring-primary"
              />
            ) : (
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="w-full bg-background ring-1 ring-border px-3 py-2 text-sm focus:outline-none focus:ring-primary"
              />
            )}
            <div className="flex gap-2">
              <button onClick={() => setAdding(false)} className="flex-1 ring-1 ring-border py-2 font-mono text-xs uppercase tracking-widest">
                Cancelar
              </button>
              <button
                onClick={() => addTpl.mutate()}
                disabled={
                  !form.name.trim() || addTpl.isPending ||
                  (form.frequency === "custom" && !form.custom_at) ||
                  (form.frequency !== "custom" && !form.time)
                }
                className="flex-1 bg-primary text-primary-foreground py-2 font-display uppercase tracking-widest text-sm disabled:opacity-50"
              >
                Criar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full mt-6 bg-primary text-primary-foreground font-display text-lg py-3 uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <Plus className="size-5" /> Nova medicação
          </button>
        )}
      </section>
    </AppShell>
  );
}
