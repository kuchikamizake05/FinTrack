import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { cn } from "@/lib/utils";

type BrandLockupProps = {
  href: string;
  priority?: boolean;
  compact?: boolean;
  className?: string;
  ariaLabel?: string;
};

export default function BrandLockup({
  href,
  priority = false,
  compact = false,
  className,
  ariaLabel = "FinTrack",
}: BrandLockupProps) {
  const logoSize = compact ? 28 : 32;

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={cn(
        "group inline-flex shrink-0 items-center gap-2.5 text-[var(--brand-ink)] no-underline",
        className,
      )}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--brand-ink)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-[1.04]",
          compact
            ? "h-[38px] w-[38px]"
            : "h-[42px] w-[42px] max-[520px]:h-[38px] max-[520px]:w-[38px]",
        )}
      >
        <BrandLogo
          size={logoSize}
          priority={priority}
          className="brightness-0 invert"
        />
      </span>
      <span
        className={cn(
          "font-[family-name:var(--font-manrope)] font-black leading-none tracking-[-0.06em] transition-colors group-hover:text-[var(--brand-primary)]",
          compact ? "text-xl" : "text-[23px] max-[520px]:text-xl",
        )}
      >
        FinTrack
      </span>
    </Link>
  );
}
