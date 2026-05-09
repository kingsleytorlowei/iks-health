import type { ReactElement } from "react";
import { useWorkflowStore } from "../../store/workflowStore";
import { formatPercent } from "../../utils/format";

export function MetricsBar(): ReactElement {
  const metrics = useWorkflowStore((s) => s.metrics);

  const escalationRate = metrics ? formatPercent(metrics.escalationRate) : "—";
  const queueBacklog = metrics ? String(metrics.queueBacklog) : "—";
  const retryRate = metrics ? formatPercent(metrics.retryRate, 1) : "—";

  return (
    <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-3">
      <div className="rounded-lg border border-border bg-surface px-5 py-4 flex items-baseline justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-text-muted">
            Escalation Rate
          </div>
          <div className="mt-1 text-4xl font-semibold tabular-nums text-danger">
            {escalationRate}
          </div>
        </div>
        <div className="text-[11px] text-text-muted text-right max-w-[12rem]">
          Share of workflows escalated for concierge review.
        </div>
      </div>
      <div className="rounded-lg border border-border bg-surface px-5 py-4">
        <div className="text-[11px] uppercase tracking-widest text-text-muted">
          Queue Backlog
        </div>
        <div className="mt-1 text-3xl font-semibold tabular-nums">
          {queueBacklog}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-surface px-5 py-4">
        <div className="text-[11px] uppercase tracking-widest text-text-muted">
          Retry Rate
        </div>
        <div className="mt-1 text-3xl font-semibold tabular-nums">
          {retryRate}
        </div>
      </div>
    </div>
  );
}
