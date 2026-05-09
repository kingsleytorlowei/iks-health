import type {
  StageExecutionResult,
  StageName,
  ValidationOutcome,
} from "../types.js";
import { getStageThreshold } from "../agents/baseAgent.js";
import { validateInsurance } from "./insuranceValidator.js";
import { validateScheduling } from "./schedulingValidator.js";
import { validateAuthorization } from "./authorizationValidator.js";

function genericConfidenceValidator(
  stage: StageName,
  result: StageExecutionResult,
): ValidationOutcome {
  const issues: string[] = [];
  if (!result.output) issues.push("missing_output");
  if (result.confidence < getStageThreshold(stage)) {
    issues.push("confidence_below_threshold");
  }
  return { passed: issues.length === 0, issues };
}

export function validate(
  stage: StageName,
  result: StageExecutionResult,
): ValidationOutcome {
  switch (stage) {
    case "insurance_verification":
      return validateInsurance(result as StageExecutionResult<never>);
    case "scheduling_confirmation":
      return validateScheduling(result as StageExecutionResult<never>);
    case "prior_authorization":
      return validateAuthorization(result as StageExecutionResult<never>);
    case "clinical_review":
    case "billing_review":
      return genericConfidenceValidator(stage, result);
  }
}
