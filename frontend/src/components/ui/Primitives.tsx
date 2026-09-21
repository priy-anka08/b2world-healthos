import { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
        {description && <p className="text-ink-500 text-sm mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card p-6 ${className}`}>{children}</div>;
}

const toneChip: Record<string, string> = {
  brand: "bg-teal-gradient text-white",
  amber: "bg-gradient-to-br from-warning-400 to-warning-600 text-white",
  green: "bg-gradient-to-br from-success-400 to-success-600 text-white",
  red: "bg-gradient-to-br from-error-400 to-error-600 text-white",
  ink: "bg-gradient-to-br from-ink-400 to-ink-600 text-white",
  accent: "bg-gradient-to-br from-accent-400 to-accent-600 text-white",
};

const toneText: Record<string, string> = {
  brand: "text-teal-700",
  amber: "text-warning-600",
  green: "text-success-700",
  red: "text-error-600",
  ink: "text-ink-600",
  accent: "text-accent-700",
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "brand",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: string;
  tone?: "brand" | "amber" | "green" | "red" | "ink" | "accent";
}) {
  return (
    <div className="card card-hover p-5 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</span>
        {icon && (
          <span className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-base shadow-sm ${toneChip[tone]}`}>
            {icon}
          </span>
        )}
      </div>
      <div className={`text-2xl font-bold mt-3 ${toneText[tone]}`}>{value}</div>
      {hint && <div className="text-xs text-ink-400 mt-1 truncate">{hint}</div>}
    </div>
  );
}

export function Badge({ tone, children }: { tone: "brand" | "amber" | "green" | "red"; children: ReactNode }) {
  const cls = { brand: "badge-brand", amber: "badge-amber", green: "badge-green", red: "badge-red" }[tone];
  return <span className={cls}>{children}</span>;
}