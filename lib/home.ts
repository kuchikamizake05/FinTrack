export type MonthlyAccountTransaction = {
  accountId: string | null | undefined;
  type: "income" | "expense";
  amount: number;
};

export function getTimeGreeting(hour: number) {
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 19) return "Selamat sore";
  return "Selamat malam";
}

export function maskAmount(value: string, visible: boolean) {
  if (visible) return value;
  const currency = value.match(/^[^\d]*/)?.[0] || "";
  return `${currency}••••••`;
}

export function calculateGoalProgress(currentAmount: number, targetAmount: number) {
  if (targetAmount <= 0) return { percentage: 0, remaining: 0 };
  const safeCurrent = Math.max(0, currentAmount);
  return {
    percentage: Math.min(100, Math.round((safeCurrent / targetAmount) * 100)),
    remaining: Math.max(0, targetAmount - safeCurrent),
  };
}

export function calculateAccountMonthlyMovement(transactions: MonthlyAccountTransaction[]) {
  const movement = new Map<string, number>();
  for (const transaction of transactions) {
    if (!transaction.accountId) continue;
    const current = movement.get(transaction.accountId) || 0;
    const delta = transaction.type === "income" ? Number(transaction.amount) : -Number(transaction.amount);
    movement.set(transaction.accountId, current + delta);
  }
  return movement;
}

export function getInstitutionPresentation(institution: string | null, kind: string) {
  const normalized = (institution || "").toLowerCase();
  if (normalized.includes("jago")) return { initials: "J", tone: "bg-orange-100 text-orange-700" };
  if (normalized.includes("bri")) return { initials: "BRI", tone: "bg-blue-100 text-blue-700" };
  if (normalized.includes("mandiri")) return { initials: "M", tone: "bg-amber-100 text-amber-700" };
  if (normalized.includes("dana")) return { initials: "D", tone: "bg-sky-100 text-sky-700" };
  if (normalized.includes("gopay")) return { initials: "G", tone: "bg-emerald-100 text-emerald-700" };
  if (normalized.includes("stockbit")) return { initials: "S", tone: "bg-indigo-100 text-indigo-700" };
  if (normalized.includes("hfm") || normalized.includes("exness")) return { initials: "FX", tone: "bg-violet-100 text-violet-700" };
  return { initials: kind === "ewallet" ? "W" : kind === "investment" ? "INV" : kind === "trading" ? "FX" : "A", tone: "bg-slate-100 text-slate-700" };
}
