import type { WorkflowEvent, WorkflowEventType } from "../types";

const EVENT_TYPES: WorkflowEventType[] = [
  "AppointmentCreated",
  "WorkflowStarted",
  "StageStarted",
  "StageCompleted",
  "ValidationFailed",
  "RetryTriggered",
  "WorkflowEscalated",
  "ConciergeResolved",
  "WorkflowResumed",
  "WorkflowCompleted",
  "LockReclaimed",
];

export function connectEventStream(
  onEvent: (event: WorkflowEvent) => void,
): () => void {
  const source = new EventSource("/sse");
  const handler = (e: MessageEvent): void => {
    try {
      const parsed = JSON.parse(e.data) as WorkflowEvent;
      onEvent(parsed);
    } catch {
      // ignore malformed
    }
  };
  for (const type of EVENT_TYPES) {
    source.addEventListener(type, handler as EventListener);
  }
  source.onerror = () => {
    // Browser auto-reconnects; nothing to do
  };
  return () => {
    for (const type of EVENT_TYPES) {
      source.removeEventListener(type, handler as EventListener);
    }
    source.close();
  };
}
