import { nanoid } from "nanoid";
import type { WorkflowEvent, WorkflowEventType, StageName } from "../types.js";
import { store } from "../store/memoryStore.js";

type Handler = (event: WorkflowEvent) => void;

const handlers = new Set<Handler>();

export function subscribe(handler: Handler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function emit(input: {
  type: WorkflowEventType;
  appointmentId: string;
  stage?: StageName;
  summary: string;
  metadata?: Record<string, unknown>;
}): WorkflowEvent {
  const event: WorkflowEvent = {
    id: nanoid(10),
    type: input.type,
    appointmentId: input.appointmentId,
    stage: input.stage,
    summary: input.summary,
    metadata: input.metadata,
    timestamp: new Date().toISOString(),
  };
  store.appendEvent(event);
  for (const h of handlers) {
    try {
      h(event);
    } catch {
      // swallow handler errors so one bad subscriber can't break the bus
    }
  }
  return event;
}
