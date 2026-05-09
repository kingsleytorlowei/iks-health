import type { Appointment } from "../types.js";
import { store } from "../store/memoryStore.js";
import { isEligible, isLockExpired } from "../orchestrator/priorityEngine.js";
import { emit } from "../orchestrator/eventBus.js";

export function enqueue(appointment: Appointment): void {
  store.upsertAppointment(appointment);
}

export function dequeueEligible(
  workerId: string,
  now = Date.now(),
): Appointment | null {
  const candidates = store
    .listAppointments()
    .filter((a) => isEligible(a, now))
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const next = candidates[0];
  if (!next) return null;

  const wasReclaimed = next.inFlight && isLockExpired(next, now);

  next.inFlight = true;
  next.workerId = workerId;
  next.lockTimestamp = new Date(now).toISOString();
  next.updatedAt = next.lockTimestamp;
  if (next.status === "NOT_STARTED" || next.status === "CLEARED") {
    next.status = "PROCESSING";
  }
  store.upsertAppointment(next);

  if (wasReclaimed) {
    emit({
      type: "LockReclaimed",
      appointmentId: next.id,
      summary: `Lock reclaimed by ${workerId}`,
    });
  }
  return next;
}

export function release(appointmentId: string): void {
  const appointment = store.getAppointment(appointmentId);
  if (!appointment) return;
  appointment.inFlight = false;
  appointment.workerId = undefined;
  appointment.lockTimestamp = undefined;
  appointment.updatedAt = new Date().toISOString();
  store.upsertAppointment(appointment);
}

export function reclaimExpiredLocks(now = Date.now()): number {
  let reclaimed = 0;
  for (const appointment of store.listAppointments()) {
    if (appointment.inFlight && isLockExpired(appointment, now)) {
      appointment.inFlight = false;
      appointment.workerId = undefined;
      appointment.lockTimestamp = undefined;
      appointment.updatedAt = new Date(now).toISOString();
      store.upsertAppointment(appointment);
      emit({
        type: "LockReclaimed",
        appointmentId: appointment.id,
        summary: "Stale lock reclaimed by background sweep",
      });
      reclaimed++;
    }
  }
  return reclaimed;
}

export function pendingCount(now = Date.now()): number {
  return store.listAppointments().filter((a) => isEligible(a, now)).length;
}
