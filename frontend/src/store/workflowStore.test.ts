import { describe, it, expect } from "vitest";
import { useWorkflowStore } from "./workflowStore";

describe("workflowStore", () => {
  describe("selectEscalation", () => {
    it("sets the selected escalation id", () => {
      useWorkflowStore.getState().selectEscalation("esc-1");
      expect(useWorkflowStore.getState().selectedEscalationId).toBe("esc-1");
    });

    it("clears the selection when called with null", () => {
      useWorkflowStore.setState({ selectedEscalationId: "esc-1" });
      useWorkflowStore.getState().selectEscalation(null);
      expect(useWorkflowStore.getState().selectedEscalationId).toBeNull();
    });
  });

  describe("markEscalationsRead", () => {
    it("advances lastReadEscalationAt to the current time", () => {
      useWorkflowStore.setState({ lastReadEscalationAt: 0 });
      const before = Date.now();
      useWorkflowStore.getState().markEscalationsRead();
      const after = Date.now();
      const last = useWorkflowStore.getState().lastReadEscalationAt;
      expect(last).toBeGreaterThanOrEqual(before);
      expect(last).toBeLessThanOrEqual(after);
    });

    it("increments flashEscalationsTick on every call", () => {
      const start = useWorkflowStore.getState().flashEscalationsTick;
      useWorkflowStore.getState().markEscalationsRead();
      useWorkflowStore.getState().markEscalationsRead();
      useWorkflowStore.getState().markEscalationsRead();
      expect(useWorkflowStore.getState().flashEscalationsTick).toBe(start + 3);
    });
  });
});
