import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/tools")({
  component: ToolsPage,
});

function ToolsPage() {
  return (
    <AppShell>
      <PageHeader kicker="Calculadoras" title="FERRAMENTAS" />
      <section className="px-6 space-y-6 animate-slide-up [animation-delay:100ms]">
        <ImcCalc />
        <DoseCalc />
      </section>
    </AppShell>
  );
}

function classifyImc(imc: number) {
  if (imc < 18.5) return "Abaixo do peso";
  if (imc < 25) return "Peso normal";
  if (imc < 30) return "Sobrepeso";
  if (imc < 35) return "Obesidade I";
  if (imc < 40) return "Obesidade II";
  return "Obesidade III";
}

function ImcCalc() {
  const [h, setH] = useState("");
  const [w, setW] = useState("");
  const imc = h && w ? Number(w) / Math.pow(Number(h) / 100, 2) : 0;

  return (
    <div className="bg-surface ring-1 ring-border p-5">
      <h2 className="font-display text-xl uppercase tracking-tight">IMC</h2>
      <p className="font-mono text-[10px] text-muted uppercase tracking-widest">Índice de Massa Corporal</p>
      <div className="grid grid-cols-2 gap-2 mt-4">
        <label className="flex flex-col">
          <span className="font-mono text-[10px] uppercase text-muted">Altura (cm)</span>
          <input type="number" value={h} onChange={(e) => setH(e.target.value)} className="bg-background ring-1 ring-border px-3 py-2 text-lg font-display focus:outline-none focus:ring-primary" />
        </label>
        <label className="flex flex-col">
          <span className="font-mono text-[10px] uppercase text-muted">Peso (kg)</span>
          <input type="number" step="0.1" value={w} onChange={(e) => setW(e.target.value)} className="bg-background ring-1 ring-border px-3 py-2 text-lg font-display focus:outline-none focus:ring-primary" />
        </label>
      </div>
      {imc > 0 && (
        <div className="mt-4 text-center">
          <p className="font-display text-5xl">{imc.toFixed(2)}</p>
          <p className="font-mono text-xs text-primary uppercase tracking-widest mt-1">{classifyImc(imc)}</p>
        </div>
      )}
    </div>
  );
}

function DoseCalc() {
  const [mgPerMl, setMgPerMl] = useState("");
  const [doseMg, setDoseMg] = useState("");
  const [refU, setRefU] = useState("8");
  const [refMg, setRefMg] = useState("2.5");

  // ml = dose / mgPerMl ; 1 ml = 100 u (insulina U-100); custom reference: refU units = refMg mg
  // Therefore: units = dose * refU / refMg
  const ml = mgPerMl && doseMg ? Number(doseMg) / Number(mgPerMl) : 0;
  const unitsByRef = refU && refMg && doseMg ? (Number(doseMg) * Number(refU)) / Number(refMg) : 0;
  const unitsByU100 = ml ? ml * 100 : 0;

  return (
    <div className="bg-surface ring-1 ring-border p-5">
      <h2 className="font-display text-xl uppercase tracking-tight">Dose por seringa</h2>
      <p className="font-mono text-[10px] text-muted uppercase tracking-widest">mg/ml → unidades</p>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <label className="flex flex-col">
          <span className="font-mono text-[10px] uppercase text-muted">Concentração (mg/ml)</span>
          <input type="number" step="0.01" value={mgPerMl} onChange={(e) => setMgPerMl(e.target.value)} className="bg-background ring-1 ring-border px-3 py-2 text-lg font-display focus:outline-none focus:ring-primary" />
        </label>
        <label className="flex flex-col">
          <span className="font-mono text-[10px] uppercase text-muted">Dose desejada (mg)</span>
          <input type="number" step="0.01" value={doseMg} onChange={(e) => setDoseMg(e.target.value)} className="bg-background ring-1 ring-border px-3 py-2 text-lg font-display focus:outline-none focus:ring-primary" />
        </label>
      </div>

      <div className="mt-4">
        <p className="font-mono text-[10px] uppercase text-muted">Referência (opcional)</p>
        <div className="flex items-center gap-2 mt-1 text-sm">
          <input type="number" value={refU} onChange={(e) => setRefU(e.target.value)} className="w-16 bg-background ring-1 ring-border px-2 py-1.5 font-mono focus:outline-none focus:ring-primary" />
          <span className="font-mono">u =</span>
          <input type="number" step="0.01" value={refMg} onChange={(e) => setRefMg(e.target.value)} className="w-20 bg-background ring-1 ring-border px-2 py-1.5 font-mono focus:outline-none focus:ring-primary" />
          <span className="font-mono">mg</span>
        </div>
      </div>

      {(ml > 0 || unitsByRef > 0) && (
        <div className="mt-5 grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="font-mono text-[10px] uppercase text-muted">Volume</p>
            <p className="font-display text-3xl">{ml.toFixed(3)}<span className="text-xs text-muted">ml</span></p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase text-muted">Seringa U-100</p>
            <p className="font-display text-3xl">{unitsByU100.toFixed(1)}<span className="text-xs text-muted">u</span></p>
          </div>
          {unitsByRef > 0 && (
            <div className="col-span-2 bg-primary/10 p-3">
              <p className="font-mono text-[10px] uppercase text-primary">Pela referência</p>
              <p className="font-display text-4xl text-primary">{unitsByRef.toFixed(1)}<span className="text-base">u</span></p>
              <p className="font-mono text-[10px] text-muted mt-1">({refU} u = {refMg} mg)</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
