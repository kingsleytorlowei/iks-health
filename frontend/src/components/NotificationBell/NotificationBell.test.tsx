import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBell } from "./NotificationBell";
import { useWorkflowStore } from "../../store/workflowStore";
import type { Escalation } from "../../types";

function escalation(over: Partial<Escalation> = {}): Escalation {
  return {
    id: "esc-default",
    appointmentId: "appt-default",
    stage: "prior_authorization",
    reason: "Insurance verification could not be completed",
    severity: "high",
    blockedSince: new Date().toISOString(),
    retryCount: 0,
    resolved: false,
    ...over,
  };
}

describe("NotificationBell", () => {
  it("renders no badge when there are no open escalations", () => {
    useWorkflowStore.setState({ escalations: [], lastReadEscalationAt: 0 });
    render(<NotificationBell />);
    expect(screen.getByRole("button")).toHaveAccessibleName(/no unread/i);
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it("counts only escalations newer than lastReadEscalationAt", () => {
    const cutoff = Date.now();
    const old = new Date(cutoff - 60_000).toISOString();
    const fresh = new Date(cutoff + 60_000).toISOString();
    useWorkflowStore.setState({
      lastReadEscalationAt: cutoff,
      escalations: [
        escalation({ id: "old-1", blockedSince: old }),
        escalation({ id: "new-1", blockedSince: fresh }),
        escalation({ id: "new-2", blockedSince: fresh }),
      ],
    });
    render(<NotificationBell />);
    expect(screen.getByRole("button")).toHaveAccessibleName(/2 unread/i);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("excludes resolved escalations from the unread count", () => {
    const fresh = new Date(Date.now() + 60_000).toISOString();
    useWorkflowStore.setState({
      lastReadEscalationAt: 0,
      escalations: [
        escalation({ id: "open-1", blockedSince: fresh, resolved: false }),
        escalation({ id: "done-1", blockedSince: fresh, resolved: true }),
      ],
    });
    render(<NotificationBell />);
    expect(screen.getByRole("button")).toHaveAccessibleName(/1 unread/i);
  });

  it("clamps the badge to 99+ when more than 99 unread", () => {
    const fresh = new Date(Date.now() + 60_000).toISOString();
    const many = Array.from({ length: 150 }, (_, i) =>
      escalation({ id: `e-${i}`, blockedSince: fresh }),
    );
    useWorkflowStore.setState({ lastReadEscalationAt: 0, escalations: many });
    render(<NotificationBell />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("clicking the bell advances lastReadEscalationAt and bumps flashEscalationsTick", async () => {
    const fresh = new Date(Date.now() + 60_000).toISOString();
    useWorkflowStore.setState({
      lastReadEscalationAt: 0,
      flashEscalationsTick: 0,
      escalations: [escalation({ id: "e1", blockedSince: fresh })],
    });
    render(<NotificationBell />);
    await userEvent.click(screen.getByRole("button"));
    const state = useWorkflowStore.getState();
    expect(state.lastReadEscalationAt).toBeGreaterThan(0);
    expect(state.flashEscalationsTick).toBe(1);
  });
});
