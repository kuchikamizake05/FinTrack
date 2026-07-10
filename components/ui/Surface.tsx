import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Surface({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "rounded-[22px] border border-emerald-100/90 bg-white shadow-[0_12px_36px_rgba(22,101,52,0.065)] sm:rounded-2xl",
        className,
      )}
      {...props}
    />
  );
}
