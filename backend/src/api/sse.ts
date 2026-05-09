import type { Request, Response } from "express";
import { subscribe } from "../orchestrator/eventBus.js";
import type { WorkflowEvent } from "../types.js";

export function sseHandler(req: Request, res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  res.write(`: connected ${new Date().toISOString()}\n\n`);

  const send = (event: WorkflowEvent): void => {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const unsubscribe = subscribe(send);

  const keepalive = setInterval(() => {
    res.write(`: keepalive ${Date.now()}\n\n`);
  }, 15_000);

  const cleanup = (): void => {
    clearInterval(keepalive);
    unsubscribe();
  };

  req.on("close", cleanup);
  req.on("error", cleanup);
}
