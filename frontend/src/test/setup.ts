import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { useWorkflowStore } from "../store/workflowStore";

const initialStoreState = useWorkflowStore.getState();

afterEach(() => {
  cleanup();
  useWorkflowStore.setState(initialStoreState, true);
});
