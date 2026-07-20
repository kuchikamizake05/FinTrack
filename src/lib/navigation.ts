import { ChartNoAxesCombined, LayoutDashboard, Receipt, TrendingUp } from "lucide-react";

export const primaryNavigation = [
  { name: "Home", href: "/dashboard", icon: LayoutDashboard },
  { name: "Transaksi", href: "/transactions", icon: Receipt },
  { name: "Investasi", href: "/investments", icon: ChartNoAxesCombined },
  { name: "Trading", href: "/trading", icon: TrendingUp },
] as const;
