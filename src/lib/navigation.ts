import { BrainCircuit, ChartNoAxesCombined, LayoutDashboard, Receipt } from "lucide-react";

export const primaryNavigation = [
  { name: "Home", href: "/dashboard", icon: LayoutDashboard },
  { name: "Transaksi", href: "/transactions", icon: Receipt },
  { name: "Portofolio", href: "/investments", icon: ChartNoAxesCombined },
  { name: "Insights", href: "/insights", icon: BrainCircuit },
] as const;

export function isNavigationActive(itemHref: string, pathname: string): boolean {
  if (itemHref === "/investments") {
    return (
      pathname === "/investments"
      || pathname.startsWith("/investments/")
      || pathname === "/trading"
      || pathname.startsWith("/trading/")
    );
  }
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}

