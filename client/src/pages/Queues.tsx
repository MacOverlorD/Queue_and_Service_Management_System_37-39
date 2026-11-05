import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, QueueSummary } from "../api";
import { useAuth } from "../auth";
import { EmptyState, ErrorBanner, Loading } from "../components/Feedback";
import { usePolling } from "../usePolling";

export default function Queues() {
  const { handleError } = useAuth();
  const navigate = useNavigate();
  const [queues, setQueues] = useState<QueueSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState<number | null>(null);

  usePolling(async () => {
    try {
      setQueues(await api.listQueues());
    } catch (err) {
      setError(handleError(err));
    }
  });

  async function join(queueId: number) {
    setError(null);
    setJoining(queueId);
    try {
      await api.joinQueue(queueId);
      navigate("/my-ticket");
    } catch (err) {
      setError(handleError(err));
    } finally {
      setJoining(null);
    }
  }

  return (
    <main className="card">
      <h1>Service queues</h1>
      <ErrorBanner message={error} />
      {queues === null && !error && <Loading />}
      {queues?.length === 0 && <EmptyState>No queues are available right now.</EmptyState>}
      <ul className="list">
        {queues?.map((q) => (
          <li key={q.id} className="list-item">
            <div>
              <h2>{q.name}</h2>
              <p className="muted">
                {q.serviceName} · {q.isOpen ? "Open" : "Closed"} · {q.waitingCount} waiting
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!q.isOpen || joining !== null}
              onClick={() => join(q.id)}
            >
              {q.isOpen ? (joining === q.id ? "Joining..." : "Join") : "Closed"}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
