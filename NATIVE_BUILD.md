# MonMon — Build nativo (Android / iOS)

O app web é uma PWA instalável (Adicionar à tela inicial). Para publicar nas lojas, use Capacitor.

## Pré-requisitos
- Node + Bun
- Android Studio (para Android)
- Xcode + macOS (para iOS)
- Contas de desenvolvedor Google Play ($25) e Apple ($99/ano)

## Primeiro setup
```bash
bun install
bun run build
npx cap add android
npx cap add ios
npx cap sync
```

## Abrir no IDE nativo
```bash
npx cap open android   # Android Studio
npx cap open ios       # Xcode
```

## Hot-reload no celular durante desenvolvimento
Aponte o Capacitor para a URL do preview Lovable:
```bash
CAP_SERVER_URL="https://project--47c42f38-f030-4105-878e-c7b088f77ea9.lovable.app" npx cap sync
```

## Push nativo (FCM/APNs) — futuro
Web Push funciona quando o app é instalado como PWA. Para push nativo dentro do app empacotado, depois configure:
- Android: Firebase Cloud Messaging + `@capacitor/push-notifications`
- iOS: Apple Push Notification (APNs) + certificados na conta Apple Developer

## Cobrança nas lojas
Hoje a cobrança é via Stripe (web). Para publicar nas lojas:
- Android: Google Play Billing (substituir / adicionar fluxo)
- iOS: Apple In-App Purchase (obrigatório para conteúdo digital)
Isso exige plugin nativo e validação server-side adicional.
