import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background grid place-items-center">
        <div className="font-mono text-xs text-muted uppercase tracking-widest animate-pulse">
          Carregando…
        </div>
      </div>
    );
  }
  return <Navigate to={user ? "/app" : "/auth"} replace />;
}
