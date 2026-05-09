import type { ReactElement } from "react";
import clsx from "clsx";
import type { Appointment, StageName } from "../../types";
import { formatStage } from "../../utils/format";

interface Props {
  appointment: Appointment;
  stages: StageName[];
  failedStage?: StageName;
}

type GlyphState = "complete" | "active" | "failed" | "pending";

function glyphFor(state: GlyphState): string {
  switch (state) {
    case "complete":
      return "✓";
    case "failed":
      return "!";
    case "active":
      return "…";
    case "pending":
    default:
      return "○";
  }
}

function colorFor(state: GlyphState): string {
  switch (state) {
    case "complete":
      return "bg-success/20 text-success border-success/40";
    case "failed":
      return "bg-danger/20 text-danger border-danger/40";
    case "active":
      return "bg-accent/20 text-accent border-accent/40";
    case "pending":
    default:
      return "bg-surface-2 text-text-muted border-border";
  }
}

export function WorkflowTimeline({
  appointment,
  stages,
  failedStage,
}: Props): ReactElement {
  const currentIdx = appointment.currentStage
    ? stages.indexOf(appointment.currentStage)
    : -1;

  return (
    <ol className="space-y-2">
      {stages.map((stage, i) => {
        let state: GlyphState;
        if (failedStage === stage) state = "failed";
        else if (appointment.status === "COMPLETE") state = "complete";
        else if (i < currentIdx) state = "complete";
        else if (i === currentIdx) state = "active";
        else state = "pending";

        return (
          <li
            key={stage}
            className={clsx(
              "flex items-center gap-3 rounded border px-3 py-2",
              colorFor(state),
            )}
          >
            <span className="font-mono text-sm w-5 text-center">
              {glyphFor(state)}
            </span>
            <span className="text-sm">{formatStage(stage)}</span>
          </li>
        );
      })}
    </ol>
  );
}
