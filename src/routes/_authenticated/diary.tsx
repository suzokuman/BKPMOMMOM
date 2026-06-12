import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, X, Camera } from "lucide-react";
import { format, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell, PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/diary")({
  component: DiaryPage,
});

function weekKey(d: Date) {
  const w = startOfWeek(d, { weekStartsOn: 1 });
  return format(w, "yyyy-MM-dd");
}

function DiaryPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const q = useQuery({
    queryKey: ["diary", user!.id],
    queryFn: async () => {
      const [entries, photos, profile] = await Promise.all([
        supabase.from("weekly_diary").select("*").order("week_start", { ascending: false }),
        supabase.from("weekly_diary_photos").select("*"),
        supabase.from("profiles").select("height_cm").eq("id", user!.id).maybeSingle(),
      ]);
      return { entries: entries.data ?? [], photos: photos.data ?? [], profile: profile.data };
    },
  });

  return (
    <AppShell>
      <PageHeader kicker="Semanal" title="DIÁRIO" />

      <section className="px-6 animate-slide-up [animation-delay:100ms] space-y-3">
        {(q.data?.entries ?? []).map((e) => {
          const photos = (q.data?.photos ?? []).filter((p) => p.diary_id === e.id);
          return (
            <EntryCard
              key={e.id}
              entry={e}
              photos={photos}
              isEditing={editing === e.id}
              onEdit={() => setEditing(e.id)}
              onClose={() => setEditing(null)}
              userId={user!.id}
              heightCm={q.data?.profile?.height_cm ? Number(q.data.profile.height_cm) : null}
            />
          );
        })}
        {(q.data?.entries ?? []).length === 0 && !creating && (
          <div className="text-center text-xs text-muted font-mono uppercase py-6">
            Sem entradas — registre sua primeira semana
          </div>
        )}

        {creating ? (
          <EntryForm
            userId={user!.id}
            heightCm={q.data?.profile?.height_cm ? Number(q.data.profile.height_cm) : null}
            defaultWeekStart={weekKey(new Date())}
            onDone={() => {
              setCreating(false);
              qc.invalidateQueries({ queryKey: ["diary"] });
            }}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="w-full bg-primary text-primary-foreground font-display text-lg py-3 uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <Plus className="size-5" /> Nova semana
          </button>
        )}

        {q.data?.profile?.height_cm == null && (
          <p className="text-[10px] font-mono text-muted text-center mt-2">
            Cadastre sua altura em Ajustes para calcular IMC automaticamente.
          </p>
        )}
      </section>
    </AppShell>
  );
}

function calcIMC(weight: number, heightCm: number) {
  const h = heightCm / 100;
  if (!h) return null;
  return weight / (h * h);
}

function EntryCard({
  entry,
  photos,
  isEditing,
  onEdit,
  onClose,
  userId,
  heightCm,
}: {
  entry: { id: string; week_start: string; weight_kg: number | null; waist_cm: number | null; thigh_cm: number | null; arm_cm: number | null; imc: number | null; notes: string | null };
  photos: { id: string; storage_path: string }[];
  isEditing: boolean;
  onEdit: () => void;
  onClose: () => void;
  userId: string;
  heightCm: number | null;
}) {
  const qc = useQueryClient();
  const [urls, setUrls] = useState<Record<string, string>>({});

  // Lazy sign urls
  useState(() => {
    Promise.all(
      photos.map(async (p) => {
        const { data } = await supabase.storage.from("diary-photos").createSignedUrl(p.storage_path, 3600);
        return [p.id, data?.signedUrl ?? ""] as const;
      }),
    ).then((entries) => setUrls(Object.fromEntries(entries)));
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("weekly_diary").delete().eq("id", entry.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diary"] }),
  });

  if (isEditing) {
    return (
      <EntryForm
        userId={userId}
        heightCm={heightCm}
        existing={entry}
        existingPhotos={photos}
        defaultWeekStart={entry.week_start}
        onDone={() => {
          onClose();
          qc.invalidateQueries({ queryKey: ["diary"] });
        }}
        onCancel={onClose}
      />
    );
  }

  return (
    <div className="bg-surface ring-1 ring-border p-4">
      <div className="flex justify-between items-baseline">
        <h3 className="font-display text-lg">
          {format(new Date(entry.week_start + "T12:00"), "dd MMM yyyy", { locale: ptBR })}
        </h3>
        <div className="flex gap-3">
          <button onClick={onEdit} className="font-mono text-[10px] uppercase text-primary">editar</button>
          <button onClick={() => del.mutate()} className="font-mono text-[10px] uppercase text-muted">remover</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-3 text-center">
        <Metric label="Peso" v={entry.weight_kg} u="kg" />
        <Metric label="Cintura" v={entry.waist_cm} u="cm" />
        <Metric label="IMC" v={entry.imc} u="" />
        <Metric label="Coxa" v={entry.thigh_cm} u="cm" />
        <Metric label="Braço" v={entry.arm_cm} u="cm" />
      </div>
      {entry.notes && <p className="text-xs text-muted mt-3">{entry.notes}</p>}
      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {photos.map((p) => (
            <img key={p.id} src={urls[p.id]} alt="" className="w-full aspect-square object-cover" />
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, v, u }: { label: string; v: number | null; u: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase text-muted">{label}</p>
      <p className="font-display text-lg">
        {v != null ? Number(v).toFixed(1) : "—"}
        {v != null && <span className="text-xs text-muted">{u}</span>}
      </p>
    </div>
  );
}

function EntryForm({
  userId,
  heightCm,
  existing,
  existingPhotos = [],
  defaultWeekStart,
  onDone,
  onCancel,
}: {
  userId: string;
  heightCm: number | null;
  existing?: { id: string; weight_kg: number | null; waist_cm: number | null; thigh_cm: number | null; arm_cm: number | null; notes: string | null };
  existingPhotos?: { id: string; storage_path: string }[];
  defaultWeekStart: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    week_start: defaultWeekStart,
    weight: existing?.weight_kg ? String(existing.weight_kg) : "",
    waist: existing?.waist_cm ? String(existing.waist_cm) : "",
    thigh: existing?.thigh_cm ? String(existing.thigh_cm) : "",
    arm: existing?.arm_cm ? String(existing.arm_cm) : "",
    notes: existing?.notes ?? "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const weight = form.weight ? Number(form.weight) : null;
      const imc = weight && heightCm ? calcIMC(weight, heightCm) : null;
      const payload = {
        user_id: userId,
        week_start: form.week_start,
        weight_kg: weight,
        waist_cm: form.waist ? Number(form.waist) : null,
        thigh_cm: form.thigh ? Number(form.thigh) : null,
        arm_cm: form.arm ? Number(form.arm) : null,
        imc,
        notes: form.notes || null,
      };

      let diaryId = existing?.id;
      if (existing) {
        const { error } = await supabase.from("weekly_diary").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("weekly_diary")
          .upsert(payload, { onConflict: "user_id,week_start" })
          .select("id")
          .single();
        if (error) throw error;
        diaryId = data.id;
      }

      const allowed = 2 - existingPhotos.length;
      const toUpload = files.slice(0, Math.max(0, allowed));
      for (const f of toUpload) {
        const ext = f.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${userId}/${diaryId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("diary-photos").upload(path, f, { upsert: false });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("weekly_diary_photos").insert({
          diary_id: diaryId!,
          user_id: userId,
          storage_path: path,
        });
        if (insErr) throw insErr;
      }
      toast.success("Diário salvo");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-surface ring-1 ring-border p-4 space-y-2">
      <label className="block">
        <span className="font-mono text-[10px] uppercase text-muted">Semana iniciando em</span>
        <input
          type="date"
          value={form.week_start}
          onChange={(e) => setForm({ ...form, week_start: e.target.value })}
          className="w-full bg-background ring-1 ring-border px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-primary"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <NumInput label="Peso (kg)" v={form.weight} on={(v) => setForm({ ...form, weight: v })} />
        <NumInput label="Cintura (cm)" v={form.waist} on={(v) => setForm({ ...form, waist: v })} />
        <NumInput label="Coxa (cm)" v={form.thigh} on={(v) => setForm({ ...form, thigh: v })} />
        <NumInput label="Braço (cm)" v={form.arm} on={(v) => setForm({ ...form, arm: v })} />
      </div>
      <textarea
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
        placeholder="Notas"
        rows={2}
        className="w-full bg-background ring-1 ring-border px-3 py-2 text-sm focus:outline-none focus:ring-primary"
      />
      <label className="flex items-center gap-2 bg-background ring-1 ring-border px-3 py-2 cursor-pointer">
        <Camera className="size-4 text-primary" />
        <span className="text-xs font-mono uppercase">
          {files.length > 0 ? `${files.length} foto(s) selecionada(s)` : `Adicionar fotos (até ${2 - existingPhotos.length})`}
        </span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 2))}
        />
      </label>
      {form.weight && heightCm && (
        <p className="font-mono text-[10px] text-primary text-center">
          IMC calculado: {calcIMC(Number(form.weight), heightCm)?.toFixed(2)}
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 ring-1 ring-border py-2 font-mono text-xs uppercase tracking-widest">
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={busy}
          className="flex-1 bg-primary text-primary-foreground py-2 font-display uppercase tracking-widest text-sm disabled:opacity-50"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}

function NumInput({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <label className="flex flex-col">
      <span className="font-mono text-[9px] uppercase text-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        value={v}
        onChange={(e) => on(e.target.value)}
        className="bg-background ring-1 ring-border px-2 py-1.5 text-sm focus:outline-none focus:ring-primary"
      />
    </label>
  );
}
