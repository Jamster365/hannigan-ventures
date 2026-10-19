import Link from "next/link";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "violet" | "ink";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-surface-muted text-secondary",
  green: "bg-green-pale text-green",
  amber: "bg-amber-pale text-amber",
  red: "bg-red-pale text-red",
  blue: "bg-blue-pale text-blue",
  violet: "bg-violet-pale text-violet",
  ink: "bg-ink text-white",
};

export function Pill({ tone = "neutral", className, children, icon }: { tone?: Tone; className?: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium leading-none whitespace-nowrap", toneClasses[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full bg-surface-muted px-2.5 py-1 text-[12px] font-medium text-secondary whitespace-nowrap", className)}>{children}</span>;
}

export function Card({ className, children, as: Tag = "div", ...rest }: { className?: string; children: ReactNode; as?: "div" | "article" | "section" | "li" } & Omit<HTMLAttributes<HTMLElement>, "children">) {
  return (
    <Tag className={cn("rounded-[var(--radius-card)] border border-hairline bg-surface shadow-[var(--shadow-card)]", className)} {...rest}>
      {children}
    </Tag>
  );
}

export function SectionHeader({ title, action, href, className, eyebrow }: { title: string; action?: string; href?: string; className?: string; eyebrow?: string }) {
  return (
    <div className={cn("flex items-end justify-between px-4", className)}>
      <div>
        {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-tertiary">{eyebrow}</p> : null}
        <h2 className="font-serif text-[20px] font-semibold leading-tight text-ink">{title}</h2>
      </div>
      {action && href ? (
        <Link href={href} className="inline-flex min-h-[32px] items-center gap-0.5 text-[13px] font-medium text-secondary hover:text-ink">
          {action}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m9 18 6-6-6-6" />
          </svg>
        </Link>
      ) : null}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
const buttonClasses: Record<ButtonVariant, string> = {
  primary: "bg-ink text-white hover:bg-ink-deep disabled:bg-ink/50",
  secondary: "bg-blue-pale text-blue hover:bg-[#dbe6f3]",
  outline: "border border-hairline-strong bg-surface text-ink hover:bg-surface-muted",
  ghost: "text-ink hover:bg-surface-muted",
  danger: "bg-red-pale text-red hover:bg-[#f8dcdb]",
};

export function Button({ variant = "primary", size = "md", className, ...rest }: ComponentProps<"button"> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" && "min-h-[36px] px-3.5 text-[13px]",
        size === "md" && "min-h-[44px] px-5 text-[14px]",
        size === "lg" && "min-h-[50px] px-6 text-[15px]",
        buttonClasses[variant],
        className,
      )}
      {...rest}
    />
  );
}

export function LinkButton({ variant = "primary", size = "md", className, ...rest }: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors",
        size === "sm" && "min-h-[36px] px-3.5 text-[13px]",
        size === "md" && "min-h-[44px] px-5 text-[14px]",
        size === "lg" && "min-h-[50px] px-6 text-[15px]",
        buttonClasses[variant],
        className,
      )}
      {...rest}
    />
  );
}

export function IconButton({ className, label, ...rest }: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn("inline-flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface-muted active:bg-surface-sunken", className)}
      {...rest}
    />
  );
}

export function EmptyState({ title, body, action, icon }: { title: string; body?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mx-4 flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-hairline-strong bg-surface/60 px-6 py-10 text-center">
      {icon ? <div className="mb-3 text-tertiary">{icon}</div> : null}
      <p className="font-serif text-[18px] font-semibold text-ink">{title}</p>
      {body ? <p className="mt-1 max-w-[32ch] text-[14px] leading-relaxed text-secondary">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function KeyFact({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: Tone }) {
  return (
    <div className="rounded-[14px] bg-surface-muted px-3.5 py-3">
      <p className="text-[12px] text-secondary">{label}</p>
      <p className={cn("mt-0.5 text-[15px] font-semibold text-ink", tone === "amber" && "text-amber", tone === "green" && "text-green")}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-tertiary">{hint}</p> : null}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-hairline", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}
