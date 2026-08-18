"use client";

import { ErrorRecoveryPanel } from "@/components/ErrorRecoveryPanel";

type SegmentErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  retry: () => void;
};

export default function SegmentError({ retry }: SegmentErrorProps) {
  return (
    <ErrorRecoveryPanel
      eyebrow="FinTrack recovery"
      title="Ruang keuangan belum bisa dimuat"
      description="Kami menghentikan tampilan ini agar data tetap aman. Coba pulihkan layar ini atau kembali ke dashboard."
      retryLabel="Coba lagi"
      dashboardLabel="Buka dashboard"
      onRetry={retry}
    />
  );
}
