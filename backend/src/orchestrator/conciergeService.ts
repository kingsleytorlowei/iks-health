import type { StageResolution } from "../types.js";
import { store } from "../store/memoryStore.js";
import { markResolved } from "../queue/escalationQueue.js";
import { getNextStage, isComplete } from "./workflowEngine.js";
import { computePriorityScore } from "./priorityEngine.js";
import { emit } from "./eventBus.js";
import { formatStage } from "./masterOrchestrator.js";

export interface ResolveInput {
  resolutionType: StageResolution["resolutionType"];
  resolvedOutput?: unknown;
  resolutionNotes: string;
  resolvedBy: string;
}

export class ConciergeError extends Error {}

export function resolveEscalation(escalationId: string, input: ResolveInput): {
  appointmentId: string;
  resolution: StageResolution;
} {
  const escalation = store.getEscalation(escalationId);
  if (!escalation) {
    throw new ConciergeError(`Escalation ${escalationId} not found`);
  }
  if (escalation.resolved) {
    throw new ConciergeError(`Escalation ${escalationId} already resolved`);
  }
  const appointment = store.getAppointment(escalation.appointmentId);
  if (!appointment) {
    throw new ConciergeError(
      `Appointment ${escalation.appointmentId} not found for escalation`,
    );
  }

  const resolution: StageResolution = {
    stage: escalation.stage,
    resolutionType: input.resolutionType,
    resolvedOutput: input.resolvedOutput,
    resolutionNotes: input.resolutionNotes,
    resolvedBy: input.resolvedBy,
    resolvedAt: new Date().toISOString(),
  };
  store.attachResolution(appointment.id, resolution);
  markResolved(escalation.id);

  emit({
    type: "ConciergeResolved",
    appointmentId: appointment.id,
    stage: escalation.stage,
    summary: `${formatStage(escalation.stage)} resolved by ${input.resolvedBy} (${input.resolutionType})`,
    metadata: { resolutionType: input.resolutionType, notes: input.resolutionNotes },
  });

  appointment.escalationReason = undefined;
  appointment.status = "CLEARED";

  if (input.resolutionType === "OVERRIDE") {
    // Override is authoritative for this stage — advance to next stage
    if (isComplete(appointment.workflowId, escalation.stage)) {
      appointment.status = "COMPLETE";
      appointment.currentStage = escalation.stage;
      emit({
        type: "WorkflowCompleted",
        appointmentId: appointment.id,
        summary: `Workflow complete for ${appointment.patientName} (override)`,
      });
    } else {
      const next = getNextStage(appointment.workflowId, escalation.stage);
      appointment.currentStage = next ?? escalation.stage;
      appointment.status = "PROCESSING";
      appointment.retryCount = 0;
      emit({
        type: "WorkflowResumed",
        appointmentId: appointment.id,
        stage: appointment.currentStage,
        summary: `Resumed at ${formatStage(appointment.currentStage!)} after override`,
      });
    }
  } else {
    // RETRY: stay on same stage, reset retry count
    appointment.currentStage = escalation.stage;
    appointment.status = "PROCESSING";
    appointment.retryCount = 0;
    emit({
      type: "WorkflowResumed",
      appointmentId: appointment.id,
      stage: appointment.currentStage,
      summary: `Resumed at ${formatStage(escalation.stage)} for retry`,
    });
  }

  appointment.priorityScore = computePriorityScore(appointment);
  appointment.updatedAt = new Date().toISOString();
  store.upsertAppointment(appointment);

  return { appointmentId: appointment.id, resolution };
}
