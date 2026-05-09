import { nanoid } from "nanoid";
import type { Appointment, Severity, StageName } from "../types.js";
import { store } from "../store/memoryStore.js";
import { dequeueEligible, reclaimExpiredLocks, release } from "../queue/appointmentQueue.js";
import { createEscalation } from "../queue/escalationQueue.js";
import { getCurrentStage, getNextStage, isComplete } from "./workflowEngine.js";
import { agentRegistry } from "../agents/agentRegistry.js";
import { validate } from "../validators/index.js";
import { decide, MAX_RETRIES } from "./decisionEngine.js";
import { computePriorityScore, recomputeAll } from "./priorityEngine.js";
import { emit } from "./eventBus.js";

const WORKER_COUNT = 2;
const WORKER_TICK_MS = 250;
const LOCK_SWEEP_MS = 5_000;
const SLA_RECOMPUTE_MS = 30_000;

let running = false;
let workerHandles: { stop: () => void }[] = [];
let lockSweepTimer: NodeJS.Timeout | null = null;
let slaTimer: NodeJS.Timeout | null = null;

function severityFor(stage: StageName, retryCount: number): Severity {
  if (stage === "prior_authorization") return "high";
  if (retryCount >= MAX_RETRIES) return "high";
  if (retryCount >= 1) return "medium";
  return "low";
}

async function processOne(workerId: string, appointment: Appointment): Promise<void> {
  const stage = getCurrentStage(appointment);
  appointment.currentStage = stage;
  appointment.status = "PROCESSING";
  store.upsertAppointment(appointment);

  emit({
    type: "StageStarted",
    appointmentId: appointment.id,
    stage,
    summary: `${formatStage(stage)} started for ${appointment.patientName}`,
  });

  const agent = agentRegistry[stage];
  const startedAt = new Date().toISOString();
  const result = await agent.execute(appointment);
  const completedAt = new Date().toISOString();

  store.appendExecution({
    id: nanoid(10),
    appointmentId: appointment.id,
    stage,
    attempt: appointment.retryCount + 1,
    result,
    startedAt,
    completedAt,
  });

  const validation = validate(stage, result);
  // Reflect the validator's outcome in the stored execution record so metrics
  // and the concierge UI see the real pass/fail, not the agent's optimistic claim.
  result.validationPassed = validation.passed;
  if (validation.issues.length) {
    result.issues = [...(result.issues ?? []), ...validation.issues];
  }
  const decision = decide({
    stage,
    result,
    validation,
    retryCount: appointment.retryCount,
  });

  if (!validation.passed) {
    emit({
      type: "ValidationFailed",
      appointmentId: appointment.id,
      stage,
      summary: `Validation failed at ${formatStage(stage)}: ${validation.issues.join(", ")}`,
      metadata: { issues: validation.issues, confidence: result.confidence },
    });
  } else {
    emit({
      type: "StageCompleted",
      appointmentId: appointment.id,
      stage,
      summary: `${formatStage(stage)} completed (confidence ${result.confidence.toFixed(2)})`,
      metadata: { confidence: result.confidence },
    });
  }

  if (decision === "continue") {
    const next = getNextStage(appointment.workflowId, stage);
    if (next === null || isComplete(appointment.workflowId, stage)) {
      appointment.status = "COMPLETE";
      appointment.currentStage = stage;
      appointment.retryCount = 0;
      release(appointment.id);
      emit({
        type: "WorkflowCompleted",
        appointmentId: appointment.id,
        summary: `Workflow complete for ${appointment.patientName}`,
      });
    } else {
      appointment.currentStage = next;
      appointment.retryCount = 0;
      release(appointment.id);
    }
  } else if (decision === "retry") {
    appointment.retryCount += 1;
    release(appointment.id);
    emit({
      type: "RetryTriggered",
      appointmentId: appointment.id,
      stage,
      summary: `Retry ${appointment.retryCount}/${MAX_RETRIES} for ${formatStage(stage)}`,
    });
  } else {
    const reason = validation.issues.length
      ? validation.issues.join(", ")
      : "confidence_below_threshold";
    appointment.status = "ESCALATED";
    appointment.escalationReason = reason;
    release(appointment.id);
    createEscalation({
      appointmentId: appointment.id,
      stage,
      reason,
      severity: severityFor(stage, appointment.retryCount),
      retryCount: appointment.retryCount,
    });
    emit({
      type: "WorkflowEscalated",
      appointmentId: appointment.id,
      stage,
      summary: `Escalated at ${formatStage(stage)}: ${reason}`,
    });
  }

  appointment.priorityScore = computePriorityScore(appointment);
  appointment.updatedAt = new Date().toISOString();
  store.upsertAppointment(appointment);
}

function startWorker(workerId: string): { stop: () => void } {
  let active = true;
  let inFlight = false;

  const tick = async (): Promise<void> => {
    if (!active) return;
    if (inFlight) return;

    const next = dequeueEligible(workerId);
    if (!next) return;

    inFlight = true;
    try {
      await processOne(workerId, next);
    } catch (err) {
      release(next.id);
      emit({
        type: "ValidationFailed",
        appointmentId: next.id,
        summary: `Worker error: ${(err as Error).message}`,
      });
    } finally {
      inFlight = false;
    }
  };

  const interval = setInterval(() => {
    void tick();
  }, WORKER_TICK_MS);

  return {
    stop: () => {
      active = false;
      clearInterval(interval);
    },
  };
}

export function startOrchestrator(): void {
  if (running) return;
  running = true;
  workerHandles = Array.from({ length: WORKER_COUNT }, (_, i) =>
    startWorker(`worker-${i + 1}`),
  );
  lockSweepTimer = setInterval(() => {
    reclaimExpiredLocks();
  }, LOCK_SWEEP_MS);
  slaTimer = setInterval(() => {
    recomputeAll();
  }, SLA_RECOMPUTE_MS);
}

export function stopOrchestrator(): void {
  if (!running) return;
  running = false;
  for (const h of workerHandles) h.stop();
  workerHandles = [];
  if (lockSweepTimer) clearInterval(lockSweepTimer);
  if (slaTimer) clearInterval(slaTimer);
  lockSweepTimer = null;
  slaTimer = null;
}

export function formatStage(stage: StageName): string {
  return stage
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
