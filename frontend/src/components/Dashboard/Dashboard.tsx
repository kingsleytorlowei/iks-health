import { useMemo, useState, type ReactElement } from "react";
import clsx from "clsx";
import { useWorkflowStore } from "../../store/workflowStore";
import type { WorkflowStatus } from "../../types";
import { MetricsBar } from "../Metrics/MetricsBar";
import { AppointmentCard } from "../AppointmentCard/AppointmentCard";
import { ExceptionQueue } from "../ExceptionQueue/ExceptionQueue";
import { NotificationBell } from "../NotificationBell/NotificationBell";

const TABS: { label: string; value: WorkflowStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Not Started", value: "NOT_STARTED" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Escalated", value: "ESCALATED" },
  { label: "Complete", value: "COMPLETE" },
];

export function Dashboard(): ReactElement {
  const [tab, setTab] = useState<WorkflowStatus | "ALL">("ALL");
  const appointments = useWorkflowStore((s) => s.appointments);

  const filtered = useMemo(() => {
    if (tab === "ALL") return appointments;
    return appointments.filter((a) => a.status === tab);
  }, [appointments, tab]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: appointments.length };
    for (const a of appointments) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  }, [appointments]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-surface px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-text-muted">
            IKS Health
          </div>
          <h1 className="text-lg font-semibold">Workflow Operations Center</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-text-muted hidden sm:block">
            Live updates via SSE
          </div>
          <NotificationBell />
        </div>
      </header>

      <main className="flex-1 px-6 py-5 space-y-5">
        <MetricsBar />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5 h-[calc(100vh-280px)] min-h-[520px]">
          <section className="flex flex-col rounded-lg border border-border bg-surface overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-1 overflow-x-auto">
              {TABS.map((t) => {
                const count = counts[t.value] ?? 0;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTab(t.value)}
                    className={clsx(
                      "px-3 py-1.5 rounded text-xs font-medium uppercase tracking-wide transition-colors",
                      tab === t.value
                        ? "bg-accent/20 text-accent"
                        : "text-text-muted hover:text-text hover:bg-surface-2",
                    )}
                  >
                    {t.label}
                    <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex-1 overflow-auto scroll-thin p-3">
              {filtered.length === 0 ? (
                <div className="text-xs text-text-muted text-center py-12">
                  No appointments in this view yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5">
                  {filtered.map((a) => (
                    <AppointmentCard key={a.id} appointment={a} />
                  ))}
                </div>
              )}
            </div>
          </section>

          <ExceptionQueue />
        </div>
      </main>
    </div>
  );
}
