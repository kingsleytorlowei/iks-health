import type { StageName, WorkflowStatus } from "../types";

export function formatStage(stage: StageName): string {
  return stage
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatStatus(status: WorkflowStatus): string {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function statusColor(status: WorkflowStatus): string {
  switch (status) {
    case "PROCESSING":
      return "bg-accent/15 text-accent border-accent/30";
    case "COMPLETE":
      return "bg-success/15 text-success border-success/30";
    case "ESCALATED":
      return "bg-danger/15 text-danger border-danger/30";
    case "CLEARED":
      return "bg-warning/15 text-warning border-warning/30";
    case "NOT_STARTED":
    default:
      return "bg-surface-2 text-text-muted border-border";
  }
}

export function severityColor(severity: "low" | "medium" | "high"): string {
  switch (severity) {
    case "high":
      return "bg-danger/15 text-danger border-danger/30";
    case "medium":
      return "bg-warning/15 text-warning border-warning/30";
    case "low":
    default:
      return "bg-surface-2 text-text-muted border-border";
  }
}
