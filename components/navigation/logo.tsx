import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { cn } from "@/lib/utils";

export function LogoMark({ className, size = 34 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className={className}>
      <path d="M6 32 22 6l5 9-8 17Z" fill="#142033" />
      <path d="M19 32 29 12l6 11-5 9Z" fill="#9aa3b2" />
    </svg>
  );
}

export function Wordmark({ className, dark }: { className?: string; dark?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark />
      <span className="leading-none">
        <span className={cn("block font-serif text-[19px] font-semibold tracking-[-0.01em]", dark ? "text-white" : "text-ink")}>{APP_NAME}</span>
        <span className={cn("mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.14em]", dark ? "text-white/60" : "text-tertiary")}>{APP_TAGLINE}</span>
      </span>
    </span>
  );
}
