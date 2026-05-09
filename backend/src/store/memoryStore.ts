import type {
  Appointment,
  Escalation,
  StageExecutionRecord,
  StageResolution,
  WorkflowEvent,
} from "../types.js";

const MAX_EVENT_HISTORY = 500;

const appointments = new Map<string, Appointment>();
const escalations = new Map<string, Escalation>();
const executions: StageExecutionRecord[] = [];
const resolutions = new Map<string, StageResolution[]>();
const events: WorkflowEvent[] = [];

export const store = {
  // appointments
  upsertAppointment(appointment: Appointment): void {
    appointments.set(appointment.id, appointment);
  },
  getAppointment(id: string): Appointment | undefined {
    return appointments.get(id);
  },
  listAppointments(): Appointment[] {
    return Array.from(appointments.values());
  },

  // escalations
  upsertEscalation(escalation: Escalation): void {
    escalations.set(escalation.id, escalation);
  },
  getEscalation(id: string): Escalation | undefined {
    return escalations.get(id);
  },
  findEscalationByAppointment(appointmentId: string): Escalation | undefined {
    for (const esc of escalations.values()) {
      if (esc.appointmentId === appointmentId && !esc.resolved) return esc;
    }
    return undefined;
  },
  listEscalations(): Escalation[] {
    return Array.from(escalations.values());
  },

  // stage execution history
  appendExecution(record: StageExecutionRecord): void {
    executions.push(record);
  },
  listExecutionsForAppointment(appointmentId: string): StageExecutionRecord[] {
    return executions.filter((e) => e.appointmentId === appointmentId);
  },
  listExecutions(): StageExecutionRecord[] {
    return executions.slice();
  },

  // resolutions (per appointment)
  attachResolution(appointmentId: string, resolution: StageResolution): void {
    const existing = resolutions.get(appointmentId) ?? [];
    existing.push(resolution);
    resolutions.set(appointmentId, existing);
  },
  listResolutionsForAppointment(appointmentId: string): StageResolution[] {
    return resolutions.get(appointmentId) ?? [];
  },

  // events (ring buffer)
  appendEvent(event: WorkflowEvent): void {
    events.push(event);
    if (events.length > MAX_EVENT_HISTORY) {
      events.splice(0, events.length - MAX_EVENT_HISTORY);
    }
  },
  listEvents(limit?: number): WorkflowEvent[] {
    if (limit === undefined) return events.slice();
    return events.slice(Math.max(0, events.length - limit));
  },

  // for tests
  reset(): void {
    appointments.clear();
    escalations.clear();
    resolutions.clear();
    executions.length = 0;
    events.length = 0;
  },
};
