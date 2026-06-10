import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app", replace: true });
  }, [user, loading, navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Conta criada. Entrando…");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao autenticar");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      const res = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (res.error) throw res.error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no Google");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground max-w-[440px] mx-auto px-6 py-12 flex flex-col">
      <div className="animate-slide-up">
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
          {mode === "login" ? "ENTRAR" : "CRIAR CONTA"}
        </span>
        <h1 className="font-display text-5xl leading-none uppercase tracking-tight mt-1">
          PULSE<span className="text-primary">.</span>
        </h1>
        <p className="text-sm text-muted mt-3">
          Metas diárias. Proteína, calorias, medicação.
        </p>
      </div>

      <button
        onClick={handleGoogle}
        disabled={busy}
        className="mt-10 w-full bg-surface ring-1 ring-border py-3 font-mono text-xs uppercase tracking-widest hover:bg-white/5 transition disabled:opacity-50"
      >
        Continuar com Google
      </button>

      <div className="flex items-center gap-3 my-6">
        <div className="h-px bg-border flex-1" />
        <span className="font-mono text-[9px] text-muted uppercase tracking-widest">ou</span>
        <div className="h-px bg-border flex-1" />
      </div>

      <form onSubmit={handleEmail} className="space-y-3">
        {mode === "signup" && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
            placeholder="Nome"
            className="w-full bg-surface ring-1 ring-border px-4 py-3 text-sm placeholder:text-muted focus:outline-none focus:ring-primary"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="email"
          className="w-full bg-surface ring-1 ring-border px-4 py-3 text-sm placeholder:text-muted focus:outline-none focus:ring-primary"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          placeholder="senha (mín. 6)"
          className="w-full bg-surface ring-1 ring-border px-4 py-3 text-sm placeholder:text-muted focus:outline-none focus:ring-primary"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-primary text-primary-foreground font-display text-lg py-3 uppercase tracking-widest active:translate-y-0.5 transition disabled:opacity-50"
        >
          {mode === "login" ? "Entrar" : "Criar conta"}
        </button>
      </form>

      <button
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="mt-6 text-xs font-mono uppercase tracking-widest text-muted hover:text-foreground"
      >
        {mode === "login" ? "Não tenho conta → criar" : "Já tenho conta → entrar"}
      </button>
    </div>
  );
}
