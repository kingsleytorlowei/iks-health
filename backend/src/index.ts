import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import express from "express";
import cors from "cors";
import { apiRouter } from "./api/routes.js";
import { sseHandler } from "./api/sse.js";
import { startIngestion } from "./ingestion/appointmentIngestionService.js";
import { startOrchestrator } from "./orchestrator/masterOrchestrator.js";

const PORT = Number(process.env.PORT ?? 4000);
const SERVE_FRONTEND = process.env.SERVE_FRONTEND === "1";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", apiRouter);
app.get("/sse", sseHandler);
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

if (SERVE_FRONTEND) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const distPath = process.env.FRONTEND_DIST
    ? path.resolve(process.env.FRONTEND_DIST)
    : path.resolve(here, "../../frontend/dist");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    // eslint-disable-next-line no-console
    console.log(`[backend] serving frontend from ${distPath}`);
  } else {
    // eslint-disable-next-line no-console
    console.warn(`[backend] SERVE_FRONTEND=1 but ${distPath} does not exist`);
  }
}

startIngestion();
startOrchestrator();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[backend] listening on http://localhost:${PORT}`);
});
