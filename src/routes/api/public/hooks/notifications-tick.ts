import { createFileRoute } from "@tanstack/react-router";

// Notifications tick — disabled while we migrate to the new meal/medication template model.
// pg_cron should keep calling this endpoint; we'll reimplement push delivery after the
// new schedule semantics settle.
export const Route = createFileRoute("/api/public/hooks/notifications-tick")({
  server: {
    handlers: {
      POST: async () => new Response(JSON.stringify({ ok: true, noop: true }), {
        headers: { "Content-Type": "application/json" },
      }),
    },
  },
});
