"use client";

import { Children, forwardRef, type ButtonHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/LanguageProvider";
import { buttonStyles } from "@/components/ui/button-styles";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles> & {
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = "button", children, loading = false, disabled, "aria-label": ariaLabel, ...props },
  ref,
) {
  const { t } = useLanguage();
  const localizedChildren = Children.map(children, (child) => {
    if (typeof child !== "string") return child;
    const source = child.trim();
    return source ? child.replace(source, t(source)) : child;
  });
  const localizedLabel = typeof ariaLabel === "string" ? t(ariaLabel) : ariaLabel;

  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonStyles({ variant, size }), className)}
      aria-label={localizedLabel}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}
      {localizedChildren}
    </button>
  );
});
