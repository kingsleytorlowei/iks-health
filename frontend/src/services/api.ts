import type {
  Appointment,
  AppointmentDetail,
  Escalation,
  MetricsSnapshot,
  ResolutionType,
  WorkflowDefinitions,
  WorkflowEvent,
  WorkflowStatus,
} from "../types";

async function jsonGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export const api = {
  appointments(status?: WorkflowStatus): Promise<Appointment[]> {
    const qs = status ? `?status=${status}` : "";
    return jsonGet(`/api/appointments${qs}`);
  },
  appointment(id: string): Promise<AppointmentDetail> {
    return jsonGet(`/api/appointments/${id}`);
  },
  escalations(): Promise<Escalation[]> {
    return jsonGet(`/api/escalations`);
  },
  metrics(): Promise<MetricsSnapshot> {
    return jsonGet(`/api/metrics`);
  },
  activity(limit = 100): Promise<WorkflowEvent[]> {
    return jsonGet(`/api/activity?limit=${limit}`);
  },
  workflowDefinitions(): Promise<WorkflowDefinitions> {
    return jsonGet(`/api/workflow-definitions`);
  },
  async resolveEscalation(
    id: string,
    body: {
      resolutionType: ResolutionType;
      resolvedOutput?: unknown;
      resolutionNotes: string;
      resolvedBy: string;
    },
  ): Promise<{ appointmentId: string }> {
    const res = await fetch(`/api/escalations/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Resolve failed: ${res.status} ${txt}`);
    }
    return (await res.json()) as { appointmentId: string };
  },
};
