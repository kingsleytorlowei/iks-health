import type { StageExecutionResult, ValidationOutcome } from "../types.js";
import { getStageThreshold } from "../agents/baseAgent.js";
import type { AuthorizationOutput } from "../agents/priorAuthorizationAgent.js";

const AUTH_CODE_PATTERN = /^AUTH-[A-Z0-9]{4,}$/;

export function validateAuthorization(
  result: StageExecutionResult<AuthorizationOutput>,
): ValidationOutcome {
  const issues: string[] = [];
  const output = result.output;

  if (!output) {
    issues.push("missing_output");
  } else {
    if (!AUTH_CODE_PATTERN.test(output.authCode)) {
      issues.push("invalid_auth_code_format");
    }
    if (!output.payerRulesSatisfied) {
      issues.push("payer_rules_not_satisfied");
    }
  }

  if (result.confidence < getStageThreshold("prior_authorization")) {
    issues.push("confidence_below_threshold");
  }

  return { passed: issues.length === 0, issues };
}
