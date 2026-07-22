"use client";

import { Children, forwardRef, type ButtonHTMLAttributes } from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/LanguageProvider";
import { buttonStyles } from "@/components/ui/button-styles";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = "button", children, "aria-label": ariaLabel, ...props },
  ref,
) {
  const { t } = useLanguage();
  const localizedChildren = Children.map(children, (child) => {
    if (typeof child !== "string") return child;
    const source = child.trim();
    return source ? child.replace(source, t(source)) : child;
  });

  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonStyles({ variant, size }), className)}
      aria-label={typeof ariaLabel === "string" ? t(ariaLabel) : ariaLabel}
      {...props}
    >
      {localizedChildren}
    </button>
  );
});
