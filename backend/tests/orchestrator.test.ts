import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { nanoid } from "nanoid";
import { store } from "../src/store/memoryStore.js";
import { enqueue, dequeueEligible, reclaimExpiredLocks } from "../src/queue/appointmentQueue.js";
import { listOpenEscalations } from "../src/queue/escalationQueue.js";
import { agentRegistry } from "../src/agents/agentRegistry.js";
import { resolveEscalation } from "../src/orchestrator/conciergeService.js";
import {
  startOrchestrator,
  stopOrchestrator,
} from "../src/orchestrator/masterOrchestrator.js";
import { stopIngestion } from "../src/ingestion/appointmentIngestionService.js";
import { computePriorityScore, LOCK_TTL_MS } from "../src/orchestrator/priorityEngine.js";
import type { Appointment, StageExecutionResult, StageName } from "../src/types.js";

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  const now = new Date().toISOString();
  const a: Appointment = {
    id: nanoid(8),
    patientName: "Test Patient",
    specialty: "dermatology",
    workflowId: "dermatology",
    scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    urgency: "medium",
    clientTier: "standard",
    status: "NOT_STARTED",
    priorityScore: 0,
    inFlight: false,
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  a.priorityScore = computePriorityScore(a);
  return a;
}

function stubAgent(stage: StageName, result: StageExecutionResult, delayMs = 5): void {
  agentRegistry[stage] = {
    stage,
    execute: async () => {
      await new Promise((r) => setTimeout(r, delayMs));
      return result;
    },
  };
}

const originalAgents = { ...agentRegistry };

describe("orchestrator", () => {
  beforeEach(() => {
    stopIngestion();
    store.reset();
  });

  afterEach(() => {
    stopOrchestrator();
    Object.assign(agentRegistry, originalAgents);
  });

  it("processes an appointment through every dermatology stage to COMPLETE", async () => {
    stubAgent("insurance_verification", {
      status: "COMPLETE",
      confidence: 0.99,
      validationPassed: true,
      retryable: false,
      output: {
        policyNumber: "POL-1",
        memberId: "MBR-1",
        expiration: new Date(Date.now() + 1e9).toISOString(),
        payer: "Aetna",
      },
    });
    stubAgent("scheduling_confirmation", {
      status: "COMPLETE",
      confidence: 0.99,
      validationPassed: true,
      retryable: false,
      output: {
        slotConfirmed: true,
        providerId: "Dr. X",
        room: "Room 100",
        conflictDetected: false,
      },
    });

    enqueue(makeAppointment());
    startOrchestrator();

    await vi.waitFor(
      () => {
        const appt = store.listAppointments()[0];
        expect(appt?.status).toBe("COMPLETE");
      },
      { timeout: 4000, interval: 50 },
    );
  });

  it("escalates after retries when validation never passes on a retryable stage", async () => {
    // Insurance is retryable in stageConfig — drive 3 failures to escalate.
    stubAgent("insurance_verification", {
      status: "COMPLETE",
      confidence: 0.5,
      validationPassed: true,
      retryable: true,
      output: {
        policyNumber: "",
        memberId: "MBR-1",
        expiration: new Date(Date.now() + 1e9).toISOString(),
        payer: "Aetna",
      },
    });

    enqueue(makeAppointment());
    startOrchestrator();

    await vi.waitFor(
      () => {
        const open = listOpenEscalations();
        expect(open.length).toBe(1);
        const appt = store.listAppointments()[0];
        expect(appt?.status).toBe("ESCALATED");
        expect(appt?.retryCount).toBeGreaterThanOrEqual(3);
      },
      { timeout: 6000, interval: 50 },
    );
  });

  it("OVERRIDE resolution advances workflow past the failed stage", async () => {
    stubAgent("insurance_verification", {
      status: "COMPLETE",
      confidence: 0.4,
      validationPassed: true,
      retryable: false,
      output: undefined,
    });
    stubAgent("scheduling_confirmation", {
      status: "COMPLETE",
      confidence: 0.99,
      validationPassed: true,
      retryable: false,
      output: {
        slotConfirmed: true,
        providerId: "Dr. X",
        room: "Room 100",
        conflictDetected: false,
      },
    });

    enqueue(makeAppointment());
    startOrchestrator();

    await vi.waitFor(
      () => {
        const open = listOpenEscalations();
        expect(open.length).toBe(1);
      },
      { timeout: 4000, interval: 50 },
    );

    const escalation = listOpenEscalations()[0]!;
    resolveEscalation(escalation.id, {
      resolutionType: "OVERRIDE",
      resolvedOutput: { policyNumber: "FORCED", memberId: "FORCED", expiration: "2099-01-01", payer: "Aetna" },
      resolutionNotes: "Manually verified",
      resolvedBy: "concierge-test",
    });

    await vi.waitFor(
      () => {
        const appt = store.listAppointments()[0];
        expect(appt?.status).toBe("COMPLETE");
      },
      { timeout: 4000, interval: 50 },
    );
  });

  it("dequeueEligible respects the priority order", () => {
    const lowPri = makeAppointment({ urgency: "low", clientTier: "standard" });
    const highPri = makeAppointment({ urgency: "high", clientTier: "vip" });
    enqueue(lowPri);
    enqueue(highPri);

    const next = dequeueEligible("worker-test");
    expect(next?.id).toBe(highPri.id);
    expect(next?.inFlight).toBe(true);
    expect(next?.workerId).toBe("worker-test");
  });

  it("reclaimExpiredLocks releases stale in-flight appointments", () => {
    const appt = makeAppointment({
      inFlight: true,
      workerId: "dead-worker",
      lockTimestamp: new Date(Date.now() - LOCK_TTL_MS - 1000).toISOString(),
      status: "PROCESSING",
    });
    enqueue(appt);

    const reclaimed = reclaimExpiredLocks();
    expect(reclaimed).toBe(1);
    const after = store.getAppointment(appt.id)!;
    expect(after.inFlight).toBe(false);
    expect(after.workerId).toBeUndefined();
  });
});
