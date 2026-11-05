import { useCallback, useState } from "react";
import { api, OperatorQueue, QueueRow } from "../api";
import { useAuth } from "../auth";
import { EmptyState, ErrorBanner, Loading } from "../components/Feedback";
import { StatusBadge } from "../components/StatusBadge";
import { usePolling } from "../usePolling";

// Operator console (F-08b). The UI only calls the API: the server decides who may act on which queue.
export default function OperatorConsole() {
  const { handleError } = useAuth();
  const [queues, setQueues] = useState<OperatorQueue[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  usePolling(async () => {
    try {
      const list = await api.operatorQueues();
      setQueues(list);
      setSelectedId((id) => (id !== null && list.some((q) => q.id === id) ? id : (list[0]?.id ?? null)));
      setError(null);
    } catch (err) {
      setError(handleError(err));
    }
  });

  return (
    <main className="card">
      <h1>Operator console</h1>
      {queues === null && !error && <Loading />}
      {queues?.length === 0 && <EmptyState>No queues assigned to you.</EmptyState>}
      {queues && queues.length > 0 && (
        <>
          <label htmlFor="queue-select" className="field-label">
            Queue
          </label>
          <select
            id="queue-select"
            className="select"
            value={selectedId ?? ""}
            onChange={(e) => {
              setSelectedId(Number(e.target.value));
              setError(null);
            }}
          >
            {queues.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>
          {/* key: switching queues remounts the panel, so it loads at once instead of after the next refresh */}
          {selectedId !== null && <QueuePanel key={selectedId} queueId={selectedId} onError={setError} />}
        </>
      )}
      <ErrorBanner message={error} />
    </main>
  );
}

function QueuePanel({ queueId, onError }: { queueId: number; onError: (message: string | null) => void }) {
  const { handleError } = useAuth();
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await api.queueEntries(queueId));
    } catch (err) {
      onError(handleError(err));
    }
  }, [queueId, handleError, onError]);
  usePolling(load);

  // Runs one operator action, shows the API message if it is rejected, then reloads the queue.
  async function act(action: () => Promise<unknown>) {
    onError(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      onError(handleError(err));
    } finally {
      setBusy(false);
    }
    await load();
  }

  if (rows === null) return <Loading />;
  const current = rows.find((r) => r.status === "CALLED" || r.status === "SERVING");
  const waiting = rows.filter((r) => r.status === "WAITING");

  return (
    <>
      <section aria-label="Now serving" className="panel">
        <h2>Now serving</h2>
        {current ? (
          <div className="list-item">
            <div>
              <p className="ticket-number">
                #{current.number} {current.customerName}
              </p>
            </div>
            <StatusBadge status={current.status} />
            {current.status === "CALLED" && (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(() => api.startEntry(current.id))}>
                Start
              </button>
            )}
            {current.status === "SERVING" && (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(() => api.completeEntry(current.id))}>
                Complete
              </button>
            )}
          </div>
        ) : (
          <EmptyState>No one is being served.</EmptyState>
        )}
      </section>

      <section className="panel">
        <h2>Waiting</h2>
        {/* Call next stays enabled when busy so the server's reason (for example QUEUE_BUSY) is shown. */}
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => act(() => api.callNext(queueId))}>
          Call next
        </button>
        {waiting.length === 0 ? (
          <EmptyState>No one is waiting.</EmptyState>
        ) : (
          <ul className="list" aria-label="Waiting list">
            {waiting.map((r) => (
              <li key={r.id} className="list-item">
                <span>
                  #{r.number} {r.customerName}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
