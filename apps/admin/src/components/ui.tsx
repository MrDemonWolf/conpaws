import { Badge } from "@conpaws/ui/components/badge";
import { buttonVariants } from "@conpaws/ui/components/button";
import { Card, CardContent } from "@conpaws/ui/components/card";
import { Input } from "@conpaws/ui/components/input";
import { Textarea } from "@conpaws/ui/components/textarea";
import { cn } from "@conpaws/ui/lib/utils";
import { CalendarDays } from "lucide-react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useId } from "react";

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-sky-800">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-3xl font-bold tracking-tight text-[#091533] sm:text-[34px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-[15px] leading-6 text-slate-600">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="w-full shrink-0 [&>a]:w-full [&>button]:w-full sm:w-auto sm:[&>a]:w-auto sm:[&>button]:w-auto">
          {action}
        </div>
      ) : null}
    </div>
  );
}

export function Button({
  children,
  href,
  variant = "primary",
  type,
  disabled,
  className,
}: {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "quiet";
  type?: "submit" | "button";
  disabled?: boolean;
  className?: string;
}) {
  const style =
    variant === "primary"
      ? "default"
      : variant === "secondary"
        ? "outline"
        : "ghost";
  const classes = buttonVariants({ variant: style, className });

  if (href) {
    return (
      <a
        href={href}
        className={cn(classes, disabled && "pointer-events-none opacity-50")}
        aria-disabled={disabled || undefined}
      >
        {children}
      </a>
    );
  }

  return (
    <button className={classes} type={type ?? "submit"} disabled={disabled}>
      {children}
    </button>
  );
}

export function Surface({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      data-slot="card"
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  error,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  const fallbackId = useId();
  const inputId = props.id ?? fallbackId;
  const errorId = `${inputId}-error`;
  return (
    <label htmlFor={inputId} className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-semibold text-slate-800">
        {label}
      </span>
      <Input
        {...props}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : props["aria-describedby"]}
      />
      {error ? (
        <span
          id={errorId}
          role="alert"
          className="mt-1.5 block text-sm font-medium text-rose-700"
        >
          {error}
        </span>
      ) : null}
      {hint ? (
        <span className="mt-1.5 block text-xs leading-5 text-slate-500">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function SelectField({
  label,
  children,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-semibold text-slate-800">
        {label}
      </span>
      <select
        {...props}
        className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground shadow-sm outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 md:text-sm"
      >
        {children}
      </select>
    </label>
  );
}

export function TextAreaField({
  label,
  error,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
}) {
  const fallbackId = useId();
  const textareaId = props.id ?? fallbackId;
  const errorId = `${textareaId}-error`;
  return (
    <label htmlFor={textareaId} className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-semibold text-slate-800">
        {label}
      </span>
      <Textarea
        {...props}
        id={textareaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : props["aria-describedby"]}
      />
      {error ? (
        <span
          id={errorId}
          role="alert"
          className="mt-1.5 block text-sm font-medium text-rose-700"
        >
          {error}
        </span>
      ) : null}
    </label>
  );
}

const statusStyles: Record<string, string> = {
  published: "border-emerald-200 bg-emerald-50 text-emerald-800",
  draft: "border-amber-200 bg-amber-50 text-amber-900",
  archived: "border-slate-200 bg-slate-100 text-slate-700",
  scheduled: "border-sky-200 bg-sky-50 text-sky-800",
  cancelled: "border-rose-200 bg-rose-50 text-rose-800",
  active: "border-emerald-200 bg-emerald-50 text-emerald-800",
  disabled: "border-slate-200 bg-slate-100 text-slate-700",
  owner: "border-violet-200 bg-violet-50 text-violet-800",
  editor: "border-slate-200 bg-slate-100 text-slate-700",
};

export function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  return (
    <Badge
      variant="outline"
      data-status={normalized}
      className={cn(
        "rounded-full px-2.5 font-semibold capitalize",
        statusStyles[normalized] ?? statusStyles.draft,
      )}
    >
      {normalized === "published" ? (
        <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      ) : null}
      {normalized.replaceAll("_", " ")}
    </Badge>
  );
}

export function Banner({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "error";
  children: ReactNode;
}) {
  const styles = {
    info: "border-sky-200 bg-sky-50 text-sky-950",
    success: "border-emerald-200 bg-emerald-50 text-emerald-950",
    error: "border-rose-200 bg-rose-50 text-rose-950",
  }[tone];
  return (
    <div
      className={`mb-5 rounded-lg border px-4 py-3 text-sm leading-6 ${styles}`}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  detail,
  accent = "sky",
  icon,
}: {
  label: string;
  value: number | string;
  detail: string;
  accent?: "sky" | "navy" | "green" | "amber";
  icon?: ReactNode;
}) {
  const tones = {
    sky: "bg-sky-50 text-sky-800",
    navy: "bg-indigo-50 text-indigo-800",
    green: "bg-emerald-50 text-emerald-800",
    amber: "bg-amber-50 text-amber-900",
  };
  return (
    <Card className="shadow-none">
      <CardContent className="min-h-[132px] p-4 sm:min-h-[124px] sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="pr-1 text-xs font-semibold text-slate-600 sm:text-sm">
            {label}
          </p>
          <span
            className={`grid size-9 shrink-0 place-items-center rounded-lg ${tones[accent]}`}
          >
            {icon ?? (
              <CalendarDays className="size-[18px]" aria-hidden="true" />
            )}
          </span>
        </div>
        <div className="mt-2">
          <p className="font-display text-2xl font-bold tabular-nums leading-none text-[#091533]">
            {value}
          </p>
          <p className="mt-1.5 text-[11px] leading-4 text-slate-500 sm:text-xs sm:leading-5">
            {detail}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center px-6 py-10 text-center">
      <span className="mb-4 grid size-11 place-items-center rounded-xl bg-sky-50 text-sky-800">
        <CalendarDays className="size-5" aria-hidden="true" />
      </span>
      <h3 className="text-base font-semibold text-[#091533]">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatMoment(value: number) {
  return `${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(value)} UTC`;
}
