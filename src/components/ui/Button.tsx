"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-lime text-ink-950 hover:bg-[#d6fb5a] shadow-[0_0_0_1px_rgba(200,243,60,0.4),0_8px_30px_-8px_rgba(200,243,60,0.45)] disabled:shadow-none",
  secondary:
    "bg-white/[0.05] text-ivory hover:bg-white/[0.09] border border-white/[0.08]",
  outline: "border border-white/[0.12] text-ivory hover:border-white/25 hover:bg-white/[0.03]",
  ghost: "text-ivory-dim hover:text-ivory hover:bg-white/[0.05]",
  danger:
    "bg-danger/10 text-[#ff8a7f] border border-danger/30 hover:bg-danger/20",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[12.5px] gap-1.5 rounded-md",
  md: "h-10 px-4 text-[13.5px] gap-2 rounded-lg",
  lg: "h-12 px-5 text-[15px] gap-2.5 rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, icon, className, children, disabled, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium tracking-[-0.005em] transition-[background,color,border-color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-4 anim-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: "sm" | "md";
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = "md", active = false, className, children, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center rounded-lg border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "size-7" : "size-9",
        active
          ? "border-lime/40 bg-lime/10 text-lime"
          : "border-white/[0.07] bg-white/[0.03] text-ivory-dim hover:border-white/15 hover:text-ivory",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
