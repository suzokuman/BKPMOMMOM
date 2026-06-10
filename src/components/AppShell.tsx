import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Beef, Flame, Pill, BarChart3 } from "lucide-react";
import type { ReactNode } from "react";

const tabs = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/protein", label: "Proteína", icon: Beef },
  { to: "/calories", label: "Calorias", icon: Flame },
  { to: "/medications", label: "Meds", icon: Pill },
  { to: "/history", label: "Histórico", icon: BarChart3 },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen bg-background text-foreground max-w-[440px] mx-auto overflow-x-hidden pb-24">
      {children}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] bg-background/90 backdrop-blur-md border-t border-border px-2 py-3 flex justify-between items-center z-50">
        {tabs.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              className="flex-1 flex flex-col items-center gap-1.5 py-1"
            >
              <Icon className={`size-5 ${active ? "text-primary" : "text-muted"}`} strokeWidth={2} />
              <span
                className={`font-mono text-[9px] uppercase tracking-tighter ${
                  active ? "text-foreground" : "text-muted"
                }`}
              >
                {label}
              </span>
              <div className={`h-0.5 w-4 ${active ? "bg-primary" : "bg-transparent"}`} />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PageHeader({ kicker, title }: { kicker: string; title: string }) {
  return (
    <header className="p-6 animate-slide-up">
      <span className="font-mono text-[10px] tracking-widest text-muted uppercase">{kicker}</span>
      <h1 className="font-display text-4xl leading-none uppercase tracking-tight mt-1">{title}</h1>
    </header>
  );
}

export function Ring({ percent, label, value }: { percent: number; label: string; value: string }) {
  const p = Math.min(100, Math.max(0, percent));
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative size-24 rounded-full grid place-items-center"
        style={{
          background: `conic-gradient(var(--color-primary) ${p}%, var(--color-border) ${p}% 100%)`,
        }}
      >
        <div className="absolute inset-1.5 rounded-full bg-background grid place-items-center">
          <span className="font-mono text-xs">{value}</span>
        </div>
      </div>
      <span className="font-mono text-[9px] uppercase tracking-tighter text-muted">{label}</span>
    </div>
  );
}
