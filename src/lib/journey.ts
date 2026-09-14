import { z } from "zod";

export const JOURNEY_MISSIONS = [
  { id: "transactions", xp: 30, href: "/transactions?status=review", title: "Review transaksi", en: "Review transactions", description: "Periksa transaksi yang perlu ditinjau dan pastikan catatanmu lengkap.", descriptionEn: "Check transactions awaiting review and make sure your records are complete." },
  { id: "planning", xp: 30, href: "/planning", title: "Cek budget atau goal", en: "Review a budget or goal", description: "Tinjau satu rencana keuangan, atau buat rencana pertamamu.", descriptionEn: "Review a financial plan, or create your first one." },
  { id: "accounts", xp: 40, href: "/planning", title: "Cocokkan saldo akun", en: "Reconcile an account", description: "Cocokkan satu saldo dengan rekeningmu lewat Rekonsiliasi saldo. Tambahkan akun dulu jika belum ada.", descriptionEn: "Match one balance to your statement using balance reconciliation. Add an account first if needed." },
] as const;

export type JourneyMission = typeof JOURNEY_MISSIONS[number]["id"];

const streakDaySchema = z.object({
  date: z.iso.date(),
  completed: z.boolean(),
});

const streakSchema = z.object({
  current: z.number().int().nonnegative(),
  longest: z.number().int().nonnegative(),
  completedToday: z.boolean(),
  days: z.array(streakDaySchema).length(7)
    .refine((days) => new Set(days.map((day) => day.date)).size === days.length),
});

const journeySchema = z.object({
  week: z.iso.date(),
  totalXp: z.number().int().nonnegative(),
  completed: z.array(z.enum(["transactions", "planning", "accounts"])).max(3)
    .refine((ids) => new Set(ids).size === ids.length),
  completeWeeks: z.number().int().nonnegative(),
  goalAchieved: z.boolean(),
  streak: streakSchema,
});

export type JourneyState = z.infer<typeof journeySchema>;
export type JourneyStreakDay = z.infer<typeof streakDaySchema>;
export const parseJourney = (value: unknown): JourneyState => journeySchema.parse(value);
export const journeyLevel = (totalXp: number) => ({ level: Math.floor(totalXp / 300) + 1, progress: totalXp % 300 });
