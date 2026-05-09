import type { StageName } from "../types.js";
import type { Agent } from "./baseAgent.js";
import { insuranceAgent } from "./insuranceAgent.js";
import { clinicalReviewAgent } from "./clinicalReviewAgent.js";
import { priorAuthorizationAgent } from "./priorAuthorizationAgent.js";
import { billingAgent } from "./billingAgent.js";
import { schedulingAgent } from "./schedulingAgent.js";

export const agentRegistry: Record<StageName, Agent> = {
  insurance_verification: insuranceAgent,
  clinical_review: clinicalReviewAgent,
  prior_authorization: priorAuthorizationAgent,
  billing_review: billingAgent,
  scheduling_confirmation: schedulingAgent,
};

export function getAgent(stage: StageName): Agent {
  return agentRegistry[stage];
}
