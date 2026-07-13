import { redirect } from "next/navigation";

// AI insight belongs to the Trading workflow so the journal, performance data,
// and reflection remain in one place.
export default function InsightsPage() {
  redirect("/trading");
}
