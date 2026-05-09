import type { Specialty, StageName } from "../types.js";

export const workflowDefinitions: Record<Specialty, StageName[]> = {
  cardiology: [
    "insurance_verification",
    "clinical_review",
    "prior_authorization",
    "scheduling_confirmation",
  ],
  dermatology: ["insurance_verification", "scheduling_confirmation"],
  surgery: [
    "insurance_verification",
    "clinical_review",
    "prior_authorization",
    "billing_review",
    "scheduling_confirmation",
  ],
};

export function getWorkflowForSpecialty(specialty: Specialty): StageName[] {
  return workflowDefinitions[specialty];
}

export function getAllWorkflowDefinitions(): Record<Specialty, StageName[]> {
  return workflowDefinitions;
}
