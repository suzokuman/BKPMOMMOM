## Visão geral

Esse é um pacote grande. Vou dividir em 5 entregas dentro deste turno, na ordem em que precisam acontecer.

---

## 1. Rebrand PULSE → MonMon

- Renomear em `auth.tsx`, `__root.tsx` (title/OG/meta), AppShell, README, toasts e qualquer string visível.
- Cores e fonte mantidos (Athletic precision escuro).
- Gerar um ícone `MonMon` (lime sobre preto) em 512×512 e 192×192 + apple-touch-icon 180×180 + favicon, em `public/`.

## 2. PWA instalável

- Criar `public/manifest.webmanifest` com `name: "MonMon"`, `short_name: "MonMon"`, `display: standalone`, `theme_color: #0A0A0A`, `background_color: #0A0A0A`, ícones gerados acima, `start_url: "/app"`.
- Adicionar `<link rel="manifest">`, `apple-touch-icon`, `apple-mobile-web-app-capable` no `__root.tsx`.
- Sem service worker de offline-cache (perigoso no preview do Lovable). Só o SW de push (item 3), que é seguro e específico.

## 3. Web Push (VAPID + cron)

Backend:
- Nova tabela `push_subscriptions(user_id, endpoint unique, p256dh, auth, user_agent, created_at)` com RLS própria.
- Nova tabela `notification_settings(user_id PK, protein_reminder_times text[], summary_morning_time time, summary_night_time time, enabled bool)` — usuário define os horários no app.
- Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (gero localmente e adiciono via add_secret).
- `VITE_VAPID_PUBLIC_KEY` exposto para o cliente assinar.

Service worker (`public/sw-push.js`):
- Só ouve `push` + `notificationclick`. Sem cache, sem `fetch` handler. Registrado só fora do iframe de preview e em produção.

Cliente:
- Tela em `/settings` (nova): toggle de notificações, horários de proteína (chips), horários de resumo manhã/noite, botão para registrar/desregistrar subscription.
- Helpers em `src/lib/push.ts` para `Notification.requestPermission()` + `pushManager.subscribe()` → salva no banco.

Envio (server):
- Biblioteca compatível com Cloudflare Workers: `@block65/webcrypto-web-push` (o `web-push` clássico usa APIs Node que quebram no Worker).
- Server route `POST /api/public/hooks/notifications-tick` (chamado a cada 5 min por pg_cron com `apikey`):
  - Para cada usuário ativo: verifica medicações em janela ±5 min não tomadas → envia push.
  - Verifica horários fixos de proteína / resumos.
  - Verifica metas: se calorias/proteína ≥ 90% e ainda não notificado → "Faltou pouco" / "Meta batida".
- Tabela `notification_log(user_id, kind, ref_id, sent_at)` para evitar duplicar.
- pg_cron `*/5 * * * *` aponta para a URL `project--{id}.lovable.app`.

## 4. Capacitor (Android + iOS)

- Adicionar `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios`.
- Criar `capacitor.config.ts` com `appId: "app.monmon"`, `appName: "MonMon"`, `webDir: "dist"`, `server.url` apontando para o preview do Lovable (modo hot-reload no celular) com instruções no README.
- README com passo-a-passo: `bun run build`, `npx cap add android`, `npx cap sync`, abrir Android Studio / Xcode.
- Push nativo (FCM/APNs) **não** entra agora — exige conta dev. Comentado no README.

## 5. Assinatura Stripe R$14,99/ano + 7 dias grátis

- Rodar `recommend_payment_provider` → enable Stripe Payments (built-in, sem conta).
- Criar produto "MonMon Premium" R$14,99/ano com 7 dias de trial.
- Tabela `subscriptions(user_id, status, current_period_end, trial_end, stripe_*)`.
- Webhook Stripe atualiza a tabela.
- Gate: depois do trial, telas principais redirecionam para `/billing` se `status` não estiver em (`trialing`, `active`).
- Tela `/billing` com botão "Assinar" → checkout, e mostrar dias restantes do trial.

---

## Detalhes técnicos

- VAPID: gero o par com `npx web-push generate-vapid-keys` no sandbox e gravo via `add_secret`. Cliente recebe só a public via `VITE_VAPID_PUBLIC_KEY`.
- Service worker de push registra-se em `/sw-push.js` com escopo `/`. Não fazer `clients.claim()` agressivo.
- `notification_log` indexada por `(user_id, kind, ref_id)` para idempotência.
- Cron a cada 5 min é suficiente — agendamentos por minuto exato têm tolerância de 5 min na UI.
- Stripe trial: passo o `trial_period_days: 7` no preço/checkout; webhook sincroniza `trial_end`.
- Capacitor não muda o build web; só adiciona configuração e dependências.

## O que vou precisar de você no caminho

1. Aprovar a migration do banco (push_subscriptions, notification_settings, notification_log, subscriptions).
2. Confirmar quando eu pedir para criar o produto no Stripe.
3. Depois, rodar localmente `npx cap add android` / `ios` na sua máquina — eu deixo tudo configurado.

Posso seguir?