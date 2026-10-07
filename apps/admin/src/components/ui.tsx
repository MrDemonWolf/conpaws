import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

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
    <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-3xl font-bold tracking-tight text-[#091533] sm:text-[34px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-[15px] leading-6 text-slate-600">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Button({
  children,
  href,
  variant = "primary",
  type,
  disabled,
}: {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "quiet";
  type?: "submit" | "button";
  disabled?: boolean;
}) {
  const styles = {
    primary:
      "bg-[#091533] text-white shadow-sm hover:bg-[#132752] focus-visible:outline-sky-600",
    secondary:
      "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-sky-600",
    quiet:
      "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-sky-600",
  }[variant];
  const className = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${styles}`;
  if (href) {
    return (
      <a href={href} className={className} aria-disabled={disabled}>
        {children}
      </a>
    );
  }
  return (
    <button className={className} type={type ?? "submit"} disabled={disabled}>
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
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_6px_24px_rgba(9,21,51,0.035)] ${className}`}
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
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold text-slate-800">
        {label}
      </span>
      <input
        {...props}
        id={props.id ?? `${props.name}-field`}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error ? `${props.name}-error` : props["aria-describedby"]
        }
        className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:bg-slate-100"
      />
      {error ? (
        <span
          id={`${props.name}-error`}
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
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold text-slate-800">
        {label}
      </span>
      <select
        {...props}
        className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
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
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold text-slate-800">
        {label}
      </span>
      <textarea
        {...props}
        id={props.id ?? `${props.name}-field`}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error ? `${props.name}-error` : props["aria-describedby"]
        }
        className="min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
      />
      {error ? (
        <span
          id={`${props.name}-error`}
          role="alert"
          className="mt-1.5 block text-sm font-medium text-rose-700"
        >
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    published: "bg-emerald-50 text-emerald-800 ring-emerald-600/15",
    draft: "bg-amber-50 text-amber-800 ring-amber-600/15",
    archived: "bg-slate-100 text-slate-600 ring-slate-400/20",
    scheduled: "bg-sky-50 text-sky-800 ring-sky-600/15",
    cancelled: "bg-rose-50 text-rose-800 ring-rose-600/15",
    active: "bg-emerald-50 text-emerald-800 ring-emerald-600/15",
    disabled: "bg-slate-100 text-slate-600 ring-slate-400/20",
    owner: "bg-violet-50 text-violet-800 ring-violet-600/15",
    editor: "bg-slate-100 text-slate-700 ring-slate-400/20",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${styles[status] ?? styles.draft}`}
    >
      {status === "published" ? (
        <span className="size-1.5 rounded-full bg-emerald-600" />
      ) : null}
      {status.replaceAll("_", " ")}
    </span>
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
      className={`mb-5 rounded-xl border px-4 py-3 text-sm leading-6 ${styles}`}
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
}: {
  label: string;
  value: number | string;
  detail: string;
  accent?: "sky" | "navy" | "green" | "amber";
}) {
  const tones = {
    sky: "bg-sky-50 text-sky-700",
    navy: "bg-indigo-50 text-indigo-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <Surface className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-600">{label}</p>
        <span
          className={`grid size-9 place-items-center rounded-xl ${tones[accent]}`}
        >
          <span className="block size-2 rounded-full bg-current" />
        </span>
      </div>
      <p className="mt-4 font-display text-3xl font-bold tabular-nums text-[#091533]">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </Surface>
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
    <div className="flex min-h-60 flex-col items-center justify-center px-6 py-12 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-sky-50 text-sky-700">
        <span className="size-3 rounded-full bg-current" />
      </span>
      <h3 className="text-lg font-bold text-[#091533]">{title}</h3>
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
