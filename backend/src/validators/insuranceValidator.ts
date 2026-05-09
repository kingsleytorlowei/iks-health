import type { StageExecutionResult, ValidationOutcome } from "../types.js";
import { getStageThreshold } from "../agents/baseAgent.js";
import type { InsuranceOutput } from "../agents/insuranceAgent.js";

export function validateInsurance(
  result: StageExecutionResult<InsuranceOutput>,
): ValidationOutcome {
  const issues: string[] = [];
  const output = result.output;

  if (!output) {
    issues.push("missing_output");
  } else {
    if (!output.policyNumber) issues.push("missing_policy_number");
    if (!output.memberId) issues.push("missing_member_id");
    if (output.expiration && new Date(output.expiration) < new Date()) {
      issues.push("policy_expired");
    }
  }

  if (result.confidence < getStageThreshold("insurance_verification")) {
    issues.push("confidence_below_threshold");
  }

  return { passed: issues.length === 0, issues };
}
