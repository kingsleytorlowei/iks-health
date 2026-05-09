import { useEffect, useState, type ReactElement } from "react";
import clsx from "clsx";
import { formatDistanceToNowStrict } from "date-fns";
import { useWorkflowStore } from "../../store/workflowStore";
import { api } from "../../services/api";
import type { AppointmentDetail, ResolutionType } from "../../types";
import { formatStage, formatTimestamp, severityColor } from "../../utils/format";
import { WorkflowTimeline } from "../WorkflowTimeline/WorkflowTimeline";

export function ConciergePanel(): ReactElement | null {
  const selectedId = useWorkflowStore((s) => s.selectedEscalationId);
  const escalations = useWorkflowStore((s) => s.escalations);
  const definitions = useWorkflowStore((s) => s.workflowDefinitions);
  const select = useWorkflowStore((s) => s.selectEscalation);

  const escalation = escalations.find((e) => e.id === selectedId);

  const [detail, setDetail] = useState<AppointmentDetail | null>(null);
  const [resolutionType, setResolutionType] = useState<ResolutionType>("OVERRIDE");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDetail(null);
    setNotes("");
    setError(null);
    setResolutionType("OVERRIDE");
    if (!escalation) return;
    let cancelled = false;
    api
      .appointment(escalation.appointmentId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [escalation?.id, escalation?.appointmentId]);

  if (!selectedId || !escalation) return null;

  const stages = detail
    ? definitions?.[detail.appointment.workflowId] ?? []
    : [];

  async function submit(): Promise<void> {
    if (!escalation) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.resolveEscalation(escalation.id, {
        resolutionType,
        resolutionNotes: notes || `${resolutionType} via concierge`,
        resolvedBy: "concierge-ui",
        resolvedOutput:
          resolutionType === "OVERRIDE"
            ? { manual: true, reason: notes || "operator override" }
            : undefined,
      });
      select(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={() => select(null)}
      />
      <aside className="fixed top-0 right-0 h-full w-full sm:w-[480px] bg-surface border-l border-border z-50 flex flex-col shadow-2xl">
        <header className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-text-muted">
              Concierge Resolution
            </div>
            <div className="mt-0.5 text-base font-semibold truncate">
              {detail?.appointment.patientName ?? escalation.appointmentId}
            </div>
            <div className="text-xs text-text-muted">
              Blocked at {formatStage(escalation.stage)} •{" "}
              {formatDistanceToNowStrict(new Date(escalation.blockedSince), {
                addSuffix: true,
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={() => select(null)}
            className="text-text-muted hover:text-text px-2 py-1 rounded hover:bg-surface-2"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-auto scroll-thin px-5 py-4 space-y-5">
          <section>
            <div className="text-[11px] uppercase text-text-muted mb-2">
              Escalation
            </div>
            <div className="rounded border border-border bg-surface-2 px-3 py-2">
              <div className="flex items-center gap-2">
                <span
                  className={clsx(
                    "text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider",
                    severityColor(escalation.severity),
                  )}
                >
                  {escalation.severity}
                </span>
                <span className="text-sm text-danger">{escalation.reason}</span>
              </div>
              <div className="mt-1 text-[11px] text-text-muted">
                Retry count at escalation: {escalation.retryCount}
              </div>
            </div>
          </section>

          {detail && (
            <section>
              <div className="text-[11px] uppercase text-text-muted mb-2">
                Workflow
              </div>
              <WorkflowTimeline
                appointment={detail.appointment}
                stages={stages}
                failedStage={escalation.stage}
              />
            </section>
          )}

          {detail && detail.executions.length > 0 && (
            <section>
              <div className="text-[11px] uppercase text-text-muted mb-2">
                Stage Execution History
              </div>
              <ul className="space-y-2">
                {detail.executions.map((exec) => (
                  <li
                    key={exec.id}
                    className="rounded border border-border bg-surface-2 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {formatStage(exec.stage)}
                        <span className="text-text-muted ml-1">
                          (attempt {exec.attempt})
                        </span>
                      </span>
                      <span
                        className={clsx(
                          "tabular-nums",
                          exec.result.validationPassed
                            ? "text-success"
                            : "text-danger",
                        )}
                      >
                        {(exec.result.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    {exec.result.issues && exec.result.issues.length > 0 && (
                      <div className="mt-1 text-text-muted">
                        Issues: {exec.result.issues.join(", ")}
                      </div>
                    )}
                    <div className="mt-1 text-[10px] text-text-muted">
                      {formatTimestamp(exec.completedAt)}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {detail && detail.resolutions.length > 0 && (
            <section>
              <div className="text-[11px] uppercase text-text-muted mb-2">
                Prior Resolutions
              </div>
              <ul className="space-y-2">
                {detail.resolutions.map((r, i) => (
                  <li
                    key={i}
                    className="rounded border border-border bg-surface-2 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span>
                        {formatStage(r.stage)} ({r.resolutionType})
                      </span>
                      <span className="text-text-muted">
                        {formatTimestamp(r.resolvedAt)}
                      </span>
                    </div>
                    <div className="mt-1 text-text-muted">{r.resolutionNotes}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <footer className="border-t border-border p-5 space-y-3 bg-surface">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setResolutionType("OVERRIDE")}
              className={clsx(
                "flex-1 px-3 py-2 rounded border text-sm",
                resolutionType === "OVERRIDE"
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border bg-surface-2 text-text-muted hover:text-text",
              )}
            >
              Override
            </button>
            <button
              type="button"
              onClick={() => setResolutionType("RETRY")}
              className={clsx(
                "flex-1 px-3 py-2 rounded border text-sm",
                resolutionType === "RETRY"
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border bg-surface-2 text-text-muted hover:text-text",
              )}
            >
              Retry Stage
            </button>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder={
              resolutionType === "OVERRIDE"
                ? "Note: this stage will not be re-validated."
                : "Note: stage will run again from scratch."
            }
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm placeholder:text-text-muted/60 focus:border-accent focus:outline-none"
          />
          {error && <div className="text-xs text-danger">{error}</div>}
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="w-full bg-accent text-background font-semibold rounded py-2 text-sm hover:bg-accent/90 disabled:opacity-50"
          >
            {submitting ? "Resolving…" : `Resolve as ${resolutionType}`}
          </button>
        </footer>
      </aside>
    </>
  );
}
