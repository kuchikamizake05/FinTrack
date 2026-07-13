import { describe, expect, it } from "vitest";
import { primaryNavigation } from "./navigation";

describe("primary navigation", () => {
  it("keeps the mobile financial workflow to four focused destinations", () => {
    expect(primaryNavigation.map((item) => item.href)).toEqual([
      "/dashboard",
      "/transactions",
      "/investments",
      "/trading",
    ]);
  });
});
