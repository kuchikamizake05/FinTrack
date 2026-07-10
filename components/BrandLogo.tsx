import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  size?: number;
  className?: string;
  alt?: string;
  priority?: boolean;
};

export default function BrandLogo({
  size = 40,
  className,
  alt = "",
  priority = false,
}: BrandLogoProps) {
  return (
    <Image
      src="/brand/fintrack-mark.png"
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
