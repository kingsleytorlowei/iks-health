import { useEffect, type ReactElement } from "react";
import { Dashboard } from "./components/Dashboard/Dashboard";
import { ConciergePanel } from "./components/ConciergePanel/ConciergePanel";
import { useWorkflowStore } from "./store/workflowStore";
import { connectEventStream } from "./services/sse";

export function App(): ReactElement {
  const hydrate = useWorkflowStore((s) => s.hydrate);
  const ingestEvent = useWorkflowStore((s) => s.ingestEvent);

  useEffect(() => {
    void hydrate();
    const disconnect = connectEventStream(ingestEvent);
    return () => disconnect();
  }, [hydrate, ingestEvent]);

  return (
    <>
      <Dashboard />
      <ConciergePanel />
    </>
  );
}
