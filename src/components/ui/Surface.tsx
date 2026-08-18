import type { HTMLAttributes } from "react";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const surfaceStyles = cva(
  "rounded-[var(--radius-surface)] border bg-[var(--surface)] sm:rounded-2xl",
  {
    variants: {
      variant: {
        default: "border-[var(--border-subtle)] shadow-[var(--shadow-surface)]",
        elevated: "border-white/80 shadow-[var(--shadow-elevated)]",
        muted: "border-emerald-100/80 bg-[var(--surface-muted)] shadow-none",
        interactive: "border-[var(--border-subtle)] shadow-[var(--shadow-surface)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[var(--shadow-elevated)]",
        warning: "border-amber-200 bg-amber-50 shadow-none",
        danger: "border-rose-200 bg-rose-50 shadow-none",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type SurfaceProps = HTMLAttributes<HTMLElement> & VariantProps<typeof surfaceStyles>;

export function Surface({ className, variant, ...props }: SurfaceProps) {
  return <section className={cn(surfaceStyles({ variant }), className)} {...props} />;
}
