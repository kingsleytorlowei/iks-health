import type { ReactElement } from "react";
import clsx from "clsx";
import type { Appointment } from "../../types";
import { useWorkflowStore } from "../../store/workflowStore";
import { formatStage } from "../../utils/format";

interface Props {
  appointment: Appointment;
}

export function AppointmentCard({ appointment }: Props): ReactElement {
  const definitions = useWorkflowStore((s) => s.workflowDefinitions);
  const escalations = useWorkflowStore((s) => s.escalations);
  const select = useWorkflowStore((s) => s.selectEscalation);

  const stages = definitions?.[appointment.workflowId] ?? [];
  const currentIdx = appointment.currentStage
    ? stages.indexOf(appointment.currentStage)
    : -1;
  const completed =
    appointment.status === "COMPLETE"
      ? stages.length
      : currentIdx >= 0
      ? currentIdx
      : 0;
  const progressPct = stages.length ? Math.round((completed / stages.length) * 100) : 0;
  const isEscalated = appointment.status === "ESCALATED";

  const matchingEscalation = isEscalated
    ? escalations.find((e) => e.appointmentId === appointment.id && !e.resolved)
    : undefined;
  const clickable = !!matchingEscalation;

  const handleClick = (): void => {
    if (matchingEscalation) select(matchingEscalation.id);
  };

  return (
    <div
      onClick={clickable ? handleClick : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
      className={clsx(
        "rounded-lg border bg-surface px-3 py-2.5 transition-colors",
        isEscalated
          ? "border-danger/40 hover:border-danger/60"
          : "border-border hover:border-accent/40",
        clickable && "cursor-pointer hover:bg-surface-2",
      )}
    >
      <div className="text-sm font-semibold truncate">{appointment.patientName}</div>
      <div className="mt-1 text-xs text-text-muted truncate">
        {appointment.currentStage ? formatStage(appointment.currentStage) : "—"}
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div
          className={clsx(
            "h-full transition-all duration-500",
            isEscalated ? "bg-danger" : "bg-accent",
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
