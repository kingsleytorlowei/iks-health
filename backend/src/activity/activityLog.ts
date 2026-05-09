import { store } from "../store/memoryStore.js";
import type { WorkflowEvent } from "../types.js";

export function getRecent(limit = 100): WorkflowEvent[] {
  return store.listEvents(limit).slice().reverse();
}
