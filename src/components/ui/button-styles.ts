import { cva } from "class-variance-authority";

export const buttonStyles = cva(
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-[background-color,border-color,color,box-shadow,transform] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.985] sm:min-h-11 sm:active:translate-y-px",
  {
    variants: {
      variant: {
        primary: "bg-emerald-700 text-white shadow-[0_8px_20px_rgba(21,128,61,0.16)] hover:bg-emerald-800",
        secondary: "border border-emerald-100 bg-white text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.04)] hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800",
        ghost: "text-slate-500 hover:bg-emerald-50 hover:text-emerald-800",
        destructive: "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
      },
      size: {
        default: "min-h-12 px-4 sm:min-h-11",
        compact: "min-h-10 rounded-lg px-3 py-2 text-xs sm:min-h-9",
        icon: "h-12 w-12 shrink-0 px-0 sm:h-11 sm:w-11",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);
