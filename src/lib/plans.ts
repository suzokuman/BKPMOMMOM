// Subscription plans (Mercado Pago).
// Plan IDs come from env on the server side; UI shows static prices.
export type PlanKey = "m3" | "m6" | "m12";

export const PLANS: Record<PlanKey, { months: number; priceBRL: number; label: string }> = {
  m3: { months: 3, priceBRL: 9.9, label: "3 meses" },
  m6: { months: 6, priceBRL: 25, label: "6 meses" },
  m12: { months: 12, priceBRL: 40, label: "12 meses" },
};
