import { useEffect, useRef, useState, type ReactElement } from "react";
import clsx from "clsx";
import { formatDistanceToNowStrict } from "date-fns";
import { useWorkflowStore } from "../../store/workflowStore";
import { formatStage, severityColor } from "../../utils/format";
import { EXCEPTION_QUEUE_ANCHOR_ID } from "../NotificationBell/NotificationBell";

const SEVERITY_RANK: Record<"low" | "medium" | "high", number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const FLASH_DURATION_MS = 1200;

export function ExceptionQueue(): ReactElement {
  const escalations = useWorkflowStore((s) => s.escalations);
  const appointments = useWorkflowStore((s) => s.appointments);
  const selectedId = useWorkflowStore((s) => s.selectedEscalationId);
  const select = useWorkflowStore((s) => s.selectEscalation);
  const flashTick = useWorkflowStore((s) => s.flashEscalationsTick);

  const [flashing, setFlashing] = useState(false);
  const initialTickRef = useRef(flashTick);

  useEffect(() => {
    if (flashTick === initialTickRef.current) return;
    setFlashing(true);
    const t = setTimeout(() => setFlashing(false), FLASH_DURATION_MS);
    return () => clearTimeout(t);
  }, [flashTick]);

  const open = escalations
    .filter((e) => !e.resolved)
    .sort((a, b) => {
      const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (sev !== 0) return sev;
      return new Date(a.blockedSince).getTime() - new Date(b.blockedSince).getTime();
    });

  const apptById = new Map(appointments.map((a) => [a.id, a]));

  return (
    <div
      id={EXCEPTION_QUEUE_ANCHOR_ID}
      className={clsx(
        "rounded-lg border bg-surface flex flex-col h-full transition-colors duration-300",
        flashing ? "border-accent ring-2 ring-accent/50" : "border-border",
      )}
    >
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide">
          Needs Your Attention
        </h3>
        <span className="text-xs text-text-muted tabular-nums">
          {open.length} open
        </span>
      </div>
      <div className="flex-1 overflow-auto scroll-thin">
        {open.length === 0 && (
          <div className="text-xs text-text-muted px-4 py-12 text-center">
            No active escalations.
          </div>
        )}
        <ul className="divide-y divide-border">
          {open.map((esc) => {
            const appt = apptById.get(esc.appointmentId);
            const blocked = formatDistanceToNowStrict(new Date(esc.blockedSince), {
              addSuffix: false,
            });
            const isSelected = selectedId === esc.id;
            return (
              <li
                key={esc.id}
                onClick={() => select(esc.id)}
                className={clsx(
                  "px-4 py-3.5 cursor-pointer hover:bg-surface-2 transition-colors",
                  isSelected && "bg-surface-2",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">
                      {appt?.patientName ?? esc.appointmentId}
                    </div>
                    <div className="text-xs text-text-muted mt-0.5 capitalize truncate">
                      {appt?.specialty ?? "—"} • {formatStage(esc.stage)}
                    </div>
                  </div>
                  <span
                    className={clsx(
                      "shrink-0 text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider",
                      severityColor(esc.severity),
                    )}
                  >
                    {esc.severity}
                  </span>
                </div>
                <div className="mt-2 text-[12px] text-danger line-clamp-2 leading-snug">
                  {esc.reason}
                </div>
                <div className="mt-2 text-[11px] text-text-muted tabular-nums">
                  Blocked {blocked}
                  {esc.retryCount > 0 && ` • ${esc.retryCount} retries`}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
