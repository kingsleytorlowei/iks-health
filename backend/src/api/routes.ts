import { Router } from "express";
import { store } from "../store/memoryStore.js";
import { listAllEscalations } from "../queue/escalationQueue.js";
import { getAllWorkflowDefinitions } from "../workflows/workflowDefinitions.js";
import { getRecent } from "../activity/activityLog.js";
import { getMetrics } from "./metrics.js";
import {
  ConciergeError,
  resolveEscalation,
} from "../orchestrator/conciergeService.js";
import type { ResolutionType, WorkflowStatus } from "../types.js";

export const apiRouter = Router();

apiRouter.get("/appointments", (req, res) => {
  const status = req.query.status as WorkflowStatus | undefined;
  const all = store.listAppointments();
  const filtered = status ? all.filter((a) => a.status === status) : all;
  filtered.sort((a, b) => b.priorityScore - a.priorityScore);
  res.json(filtered);
});

apiRouter.get("/appointments/:id", (req, res) => {
  const appointment = store.getAppointment(req.params.id);
  if (!appointment) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({
    appointment,
    executions: store.listExecutionsForAppointment(appointment.id),
    resolutions: store.listResolutionsForAppointment(appointment.id),
  });
});

apiRouter.get("/escalations", (_req, res) => {
  const escalations = listAllEscalations();
  res.json(escalations);
});

apiRouter.post("/escalations/:id/resolve", (req, res) => {
  const body = req.body as {
    resolutionType?: ResolutionType;
    resolvedOutput?: unknown;
    resolutionNotes?: string;
    resolvedBy?: string;
  };
  if (!body.resolutionType || !body.resolvedBy) {
    res.status(400).json({ error: "resolutionType_and_resolvedBy_required" });
    return;
  }
  try {
    const result = resolveEscalation(req.params.id, {
      resolutionType: body.resolutionType,
      resolvedOutput: body.resolvedOutput,
      resolutionNotes: body.resolutionNotes ?? "",
      resolvedBy: body.resolvedBy,
    });
    res.json(result);
  } catch (err) {
    if (err instanceof ConciergeError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

apiRouter.get("/metrics", (_req, res) => {
  res.json(getMetrics());
});

apiRouter.get("/activity", (req, res) => {
  const limit = Number(req.query.limit ?? 100);
  res.json(getRecent(Number.isFinite(limit) ? limit : 100));
});

apiRouter.get("/workflow-definitions", (_req, res) => {
  res.json(getAllWorkflowDefinitions());
});
