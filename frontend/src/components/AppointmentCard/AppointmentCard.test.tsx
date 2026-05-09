import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppointmentCard } from "./AppointmentCard";
import { useWorkflowStore } from "../../store/workflowStore";
import type { Appointment, Escalation, WorkflowDefinitions } from "../../types";

const DEFINITIONS: WorkflowDefinitions = {
  cardiology: [
    "insurance_verification",
    "clinical_review",
    "prior_authorization",
    "billing_review",
    "scheduling_confirmation",
  ],
  dermatology: [
    "insurance_verification",
    "clinical_review",
    "billing_review",
    "scheduling_confirmation",
  ],
  surgery: [
    "insurance_verification",
    "clinical_review",
    "prior_authorization",
    "billing_review",
    "scheduling_confirmation",
  ],
};

function appointment(over: Partial<Appointment> = {}): Appointment {
  return {
    id: "appt-1",
    patientName: "Jane Doe",
    specialty: "cardiology",
    scheduledTime: new Date(Date.now() + 86_400_000).toISOString(),
    urgency: "medium",
    clientTier: "standard",
    status: "PROCESSING",
    currentStage: "clinical_review",
    workflowId: "cardiology",
    priorityScore: 50,
    inFlight: false,
    retryCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...over,
  };
}

function escalation(over: Partial<Escalation> = {}): Escalation {
  return {
    id: "esc-1",
    appointmentId: "appt-1",
    stage: "prior_authorization",
    reason: "Authorization rejected",
    severity: "high",
    blockedSince: new Date().toISOString(),
    retryCount: 1,
    resolved: false,
    ...over,
  };
}

describe("AppointmentCard", () => {
  it("non-escalated cards are not clickable", () => {
    useWorkflowStore.setState({
      workflowDefinitions: DEFINITIONS,
      escalations: [],
    });
    render(<AppointmentCard appointment={appointment({ status: "PROCESSING" })} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("escalated card with a matching open escalation is clickable and selects it", async () => {
    useWorkflowStore.setState({
      workflowDefinitions: DEFINITIONS,
      escalations: [escalation({ id: "esc-42", appointmentId: "appt-1" })],
    });
    render(<AppointmentCard appointment={appointment({ status: "ESCALATED" })} />);
    const card = screen.getByRole("button");
    expect(card).toBeInTheDocument();
    await userEvent.click(card);
    expect(useWorkflowStore.getState().selectedEscalationId).toBe("esc-42");
  });

  it("escalated card without any matching escalation is not clickable", () => {
    useWorkflowStore.setState({
      workflowDefinitions: DEFINITIONS,
      escalations: [escalation({ appointmentId: "different-appt" })],
    });
    render(<AppointmentCard appointment={appointment({ status: "ESCALATED" })} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("escalated card with only a resolved matching escalation is not clickable", () => {
    useWorkflowStore.setState({
      workflowDefinitions: DEFINITIONS,
      escalations: [escalation({ appointmentId: "appt-1", resolved: true })],
    });
    render(<AppointmentCard appointment={appointment({ status: "ESCALATED" })} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("activates via keyboard (Enter) on an escalated card", async () => {
    useWorkflowStore.setState({
      workflowDefinitions: DEFINITIONS,
      escalations: [escalation({ id: "esc-7", appointmentId: "appt-1" })],
    });
    render(<AppointmentCard appointment={appointment({ status: "ESCALATED" })} />);
    const card = screen.getByRole("button");
    card.focus();
    await userEvent.keyboard("{Enter}");
    expect(useWorkflowStore.getState().selectedEscalationId).toBe("esc-7");
  });
});
