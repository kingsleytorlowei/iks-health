import type { ReactElement } from "react";
import clsx from "clsx";
import { useWorkflowStore } from "../../store/workflowStore";

export const EXCEPTION_QUEUE_ANCHOR_ID = "exception-queue-anchor";

export function NotificationBell(): ReactElement {
  const escalations = useWorkflowStore((s) => s.escalations);
  const lastReadAt = useWorkflowStore((s) => s.lastReadEscalationAt);
  const markRead = useWorkflowStore((s) => s.markEscalationsRead);

  const unread = escalations.filter(
    (e) => !e.resolved && new Date(e.blockedSince).getTime() > lastReadAt,
  ).length;

  const handleClick = (): void => {
    markRead();
    const el = document.getElementById(EXCEPTION_QUEUE_ANCHOR_ID);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const hasUnread = unread > 0;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={hasUnread ? `${unread} unread escalations` : "No unread escalations"}
      className={clsx(
        "relative inline-flex items-center justify-center w-9 h-9 rounded-md border transition-colors",
        hasUnread
          ? "border-danger/40 bg-danger/10 text-danger hover:bg-danger/15"
          : "border-border bg-surface text-text-muted hover:text-text hover:bg-surface-2",
      )}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {hasUnread && (
        <span
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-semibold flex items-center justify-center tabular-nums"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}
