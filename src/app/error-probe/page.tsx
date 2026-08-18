import { headers } from "next/headers";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ErrorProbePage() {
  const requestHeaders = await headers();
  const enabled = process.env.FINTRACK_ENABLE_ERROR_RECOVERY_E2E === "1";

  if (!enabled || requestHeaders.get("x-fintrack-e2e-error-surface") !== "segment") notFound();

  throw new Error("FinTrack e2e segment error");
}
