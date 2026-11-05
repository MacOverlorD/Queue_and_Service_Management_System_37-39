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

  // Refreshes on an interval so an operator's action shows up without a manual reload (AC-F08a-05).
  usePolling(async () => {
    try {
      setTickets(await api.myActiveTickets());
      setError(null);
    } catch (err) {
      setError(handleError(err));
    }
  });

  return (
    <main className="card">
      <h1>My tickets</h1>
      <ErrorBanner message={error} />
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
          </li>
        ))}
      </ul>
    </main>
  );
}
