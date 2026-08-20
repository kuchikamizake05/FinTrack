import { describe, expect, it } from "vitest";
import { isNavigationActive, primaryNavigation } from "./navigation";

describe("primary navigation", () => {
  it("keeps the mobile financial workflow to four focused destinations", () => {
    expect(primaryNavigation.map((item) => item.href)).toEqual([
      "/dashboard",
      "/transactions",
      "/investments",
      "/insights",
    ]);
  });

  it("names each primary navigation item properly", () => {
    expect(primaryNavigation.map((item) => item.name)).toEqual([
      "Home",
      "Transaksi",
      "Portofolio",
      "Insights",
    ]);
  });

  it("matches active navigation for exact routes, nested routes, and unified portfolio", () => {
    expect(isNavigationActive("/dashboard", "/dashboard")).toBe(true);
    expect(isNavigationActive("/dashboard", "/dashboard/settings")).toBe(true);
    expect(isNavigationActive("/dashboard", "/transactions")).toBe(false);

    expect(isNavigationActive("/investments", "/investments")).toBe(true);
    expect(isNavigationActive("/investments", "/investments/detail")).toBe(true);
    expect(isNavigationActive("/investments", "/trading")).toBe(true);
    expect(isNavigationActive("/investments", "/trading/review")).toBe(true);
    expect(isNavigationActive("/investments", "/insights")).toBe(false);

    expect(isNavigationActive("/insights", "/insights")).toBe(true);
  });
});

