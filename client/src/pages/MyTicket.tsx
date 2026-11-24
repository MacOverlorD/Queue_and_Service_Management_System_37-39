import { useState } from "react";
import { api, Ticket } from "../api";
import { useAuth } from "../auth";
import { EmptyState, ErrorBanner, Loading } from "../components/Feedback";
import { StatusBadge } from "../components/StatusBadge";
import { usePolling } from "../usePolling";

export default function MyTicket() {
  const { handleError } = useAuth();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    try {
      setTickets(await api.myActiveTickets());
      setError(null);
    } catch (err) {
      setError(handleError(err));
    }
  }

  // F-09: the server decides (owner only, WAITING only); a refusal shows its message.
  async function cancel(t: Ticket) {
    setCancelling(t.id);
    setNotice(null);
    try {
      await api.cancelTicket(t.id);
      setNotice(`Ticket #${t.number} in ${t.queueName} is cancelled.`);
    } catch (err) {
      setError(handleError(err));
    } finally {
      setCancelling(null);
    }
    await load();
  }

  // Refreshes on an interval so an operator's action shows up without a manual reload (AC-F08a-05).
  usePolling(load);

  return (
    <main className="card">
      <h1>My tickets</h1>
      <ErrorBanner message={error} />
      {notice && <p className="muted" role="status">{notice}</p>}
      {tickets === null && !error && <Loading />}
      {tickets?.length === 0 && <EmptyState>You are not in any queue.</EmptyState>}
      <ul className="list" aria-live="polite">
        {tickets?.map((t) => (
          <li key={t.id} className="list-item">
            <div>
              <h2>{t.queueName}</h2>
              <p className="ticket-number">Ticket #{t.number}</p>
              {t.status === "WAITING" && t.peopleAhead !== null && <p className="muted">People ahead: {t.peopleAhead}</p>}
            </div>
            <StatusBadge status={t.status} />
            {t.status === "WAITING" && (
              <button type="button" className="btn" disabled={cancelling === t.id} onClick={() => cancel(t)}>
                {cancelling === t.id ? "Cancelling..." : "Cancel ticket"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
