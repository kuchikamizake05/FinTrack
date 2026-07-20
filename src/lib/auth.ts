const PUBLIC_ROUTES = new Set(["/", "/login", "/offline"]);
const PROTECTED_ROUTE_PREFIXES = [
  "/accounts",
  "/categories",
  "/dashboard",
  "/insights",
  "/investments",
  "/onboarding",
  "/settings",
  "/trading",
  "/transactions",
] as const;

export type AuthGateState =
  | "public"
  | "loading"
  | "authenticated"
  | "redirect-login"
  | "offline"
  | "configuration-error";

export function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.has(pathname);
}

export function isProtectedRoute(pathname: string) {
  return PROTECTED_ROUTE_PREFIXES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function sanitizeNextPath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;

  try {
    const destination = new URL(value, "https://fintrack.local");
    if (destination.origin !== "https://fintrack.local" || !isProtectedRoute(destination.pathname)) return fallback;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}

export function getAuthGateState({ pathname, configured, resolved, hasSession, online }: {
  pathname: string;
  configured: boolean;
  resolved: boolean;
  hasSession: boolean;
  online: boolean;
}): AuthGateState {
  if (isPublicRoute(pathname) || !isProtectedRoute(pathname)) return "public";
  if (!configured) return "configuration-error";
  if (!resolved) return "loading";
  if (hasSession) return "authenticated";
  return online ? "redirect-login" : "offline";
}
