import { nanoid } from "nanoid";
import type { Escalation, Severity, StageName } from "../types.js";
import { store } from "../store/memoryStore.js";

export function createEscalation(input: {
  appointmentId: string;
  stage: StageName;
  reason: string;
  severity: Severity;
  retryCount: number;
}): Escalation {
  const escalation: Escalation = {
    id: nanoid(10),
    appointmentId: input.appointmentId,
    stage: input.stage,
    reason: input.reason,
    severity: input.severity,
    blockedSince: new Date().toISOString(),
    retryCount: input.retryCount,
    resolved: false,
  };
  store.upsertEscalation(escalation);
  return escalation;
}

export function listOpenEscalations(): Escalation[] {
  return store.listEscalations().filter((e) => !e.resolved);
}

export function listAllEscalations(): Escalation[] {
  return store.listEscalations();
}

export function markResolved(id: string): Escalation | undefined {
  const esc = store.getEscalation(id);
  if (!esc) return undefined;
  esc.resolved = true;
  store.upsertEscalation(esc);
  return esc;
}
