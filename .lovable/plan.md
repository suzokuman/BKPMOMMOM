
# Plano — Refatoração ampla do MONMON

Este é um trabalho grande. Vou dividir em **7 blocos**. Antes de começar, preciso confirmar algumas coisas para não desperdiçar tempo.

---

## ⚠️ Confirmações necessárias

1. **Assinatura Mercado Pago** — hoje existe **1 plano** (R$ 9,90/ano) já cadastrado no MP (`c28cb...`). Você agora pediu **3 planos**: R$ 9,90 / 3 meses, R$ 25 / 6 meses, R$ 40 / 12 meses. Precisarei que você **crie os 3 planos no painel do Mercado Pago** e me envie os 3 `preapproval_plan_id`. O plano antigo de R$ 9,90/ano deve ser desativado?

2. **Envio de email do relatório diário** — não há provedor de email configurado ainda. Sugiro usar **Resend** (você cria conta gratuita, me passa a API key). Tudo bem?

3. **Reset diário às 00:00** — em qual **fuso horário**? Vou assumir **America/Sao_Paulo (UTC-3)** salvo indicação contrária.

4. **Fotos do diário semanal** — vou ativar **Storage privado** (bucket `diary-photos`, só o dono acessa). Ok?

---

## Bloco 1 — Correções de bugs urgentes
- **Itens sumindo ao trocar meta**: a tela atual filtra refeições/proteína por `date = hoje`. Vou mudar o modelo para itens **persistentes** (template) + **checks diários** numa tabela separada. Trocar a meta nunca apagará itens.
- **Reset diário 00:00**: cria-se uma linha `daily_checks` por dia; o "consumido" lê só dos checks daquele dia. Nada é deletado — o dia novo começa zerado naturalmente.

## Bloco 2 — Nova arquitetura de Dieta
- Tela **META** separada: kcal, carbo, gordura, proteína, fibra (alvo único, editável).
- Tela **MINHA DIETA**: o usuário cria **refeições compostas** (ex.: "Jantar 20:00") e dentro adiciona alimentos (nome, qtd, kcal, carbo, gord, fibra, prot).
- Cada refeição vira um item do checklist diário com horário de alerta.
- Total do dia = soma dos alimentos das refeições marcadas.
- Alerta "🔥 meta batida" quando atinge cada macro.

## Bloco 3 — Medicação recorrente
- Form: nome, dose, **hora inicial**, **frequência** (diário, semanal, 4/4h, 6/6h, 8/8h, 10/10h, 12/12h, 14/14h, 16/16h, 18/18h, 20/20h, 22/22h) **ou** data/hora personalizada.
- Sistema gera automaticamente os horários do dia (ex.: Vitamina 12:00 + 18:00 + 00:00 + 06:00 para 6/6h).
- Itens fixos — só somem se o usuário remover o template. Os checks de "tomado" resetam a cada dia.

## Bloco 4 — Diário Semanal
- Nova tela `/diary`: entrada semanal com peso, circunferência abdominal, coxa, braço, IMC (auto-calculado se altura cadastrada), notas.
- Até 2 fotos por semana (upload para Storage privado).
- Editável (corrigir erros).
- Lista histórica das semanas.

## Bloco 5 — Calculadoras
- **Calculadora de IMC**: altura + peso → IMC + classificação.
- **Calculadora de dose por seringa**: entradas = concentração (mg/ml), dose desejada (mg), referência opcional (ex.: "8u = 2,5 mg") → resultado em **unidades de seringa (UI)** + ml.

## Bloco 6 — Assinatura (3 planos)
- Tela `/billing`: 3 cards de plano (R$ 9,90/3m · R$ 25/6m · R$ 40/12m), todos com 7 dias grátis.
- Tela `/subscription` (menu "Minha Assinatura"): status, dias restantes, botão **renovar antecipado** e **cancelar**. Cancelado = dias continuam contando até expirar + botão **reativar**.
- Tela `/billing/success` de confirmação de pagamento.
- Webhook MP já existente — adaptado para suportar os 3 planos.

## Bloco 7 — Relatórios e email diário
- Função que gera relatório de um dia (00:00–23:59): macros consumidos vs meta, medicações tomadas vs agendadas, peso da semana.
- Tela `/history`: lista de relatórios anteriores + botão "enviar por email agora".
- Config "envio automático diário 00:00": cron que gera relatório do dia anterior e dispara email via Resend.

---

## Detalhes técnicos (banco)
- Novas tabelas: `meal_templates`, `meal_template_items`, `meal_template_checks`, `medication_templates`, `medication_doses` (gerada automaticamente), `medication_checks`, `nutrition_goals` (substitui daily_calorie_goals), `weekly_diary`, `weekly_diary_photos`, `daily_reports`.
- Bucket Storage `diary-photos` (privado, RLS por user_id).
- Coluna `height_cm` em `profiles`.
- Cron pg_cron diário 03:00 UTC (= 00:00 BRT) → gera relatório + envia email.
- Secret novo: `RESEND_API_KEY` (após confirmação).

---

## Pergunta antes de seguir

**Confirma os 4 itens em "Confirmações necessárias" no topo?** Em especial precisarei dos **3 novos preapproval_plan_id do Mercado Pago** para finalizar o módulo de assinatura. Posso começar pelos **Blocos 1, 2, 3, 4, 5 e 7** em paralelo enquanto você cria os planos no MP, e fecho o Bloco 6 depois.
