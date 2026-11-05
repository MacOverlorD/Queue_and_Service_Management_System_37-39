import { EntryStatus } from "../api";

const LABELS: Record<EntryStatus, string> = {
  WAITING: "Waiting",
  CALLED: "Called",
  SERVING: "Serving",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
};

// Colour is never the only signal: the label always states the status.
export function StatusBadge({ status }: { status: EntryStatus }) {
  return (
    <span className={`badge badge-${status.toLowerCase()}`} data-testid="status-badge">
      {LABELS[status]}
    </span>
  );
}
