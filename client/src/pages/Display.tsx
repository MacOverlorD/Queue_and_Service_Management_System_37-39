import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiRequestError, QueueDisplay } from "../api";
import { ErrorBanner, Loading } from "../components/Feedback";
import { usePolling } from "../usePolling";

const STATUS_LABEL = { CALLED: "Called", SERVING: "Serving" } as const;

// Public screen for one queue (F-11, FR-17). No login; shows only the fields of the F-07 API (BR-08).
export default function Display() {
  const { queueId = "" } = useParams();
  const [data, setData] = useState<QueueDisplay | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [failed, setFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const stopped = useRef(false);

  usePolling(async () => {
    if (stopped.current) return;
    try {
      setData(await api.queueDisplay(queueId));
      setFailed(false);
      setUpdatedAt(new Date());
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 404) {
        stopped.current = true; // unknown queue: nothing to refresh
        setNotFound(true);
        return;
      }
      setFailed(true); // keep the last numbers and retry on the next interval
    }
  });

  if (notFound) {
    return (
      <main className="card display">
        <h1>Queue not found.</h1>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="card display">
        {failed ? <ErrorBanner message="Cannot load the display. Retrying." /> : <Loading />}
      </main>
    );
  }
  return (
    <main className="card display">
      <h1>{data.queueName}</h1>
      <p className="display-open" data-testid="display-open">
        {data.isOpen ? "Open" : "Closed"}
      </p>
      <ErrorBanner message={failed ? "Cannot load the display. Retrying." : null} />
      <section className="display-now" aria-label="Now serving">
        {data.currentNumber === null ? (
          <p className="display-status">No one is being served</p>
        ) : (
          <>
            <p className="display-number" data-testid="display-current-number">
              {data.currentNumber}
            </p>
            <p className="display-status" data-testid="display-current-status">
              {data.currentStatus ? STATUS_LABEL[data.currentStatus] : ""}
            </p>
          </>
        )}
      </section>
      <p className="display-waiting" data-testid="display-waiting">
        Waiting: {data.waitingCount}
      </p>
      {updatedAt && <p className="muted">Last updated {updatedAt.toLocaleTimeString("en-GB")}</p>}
    </main>
  );
}
