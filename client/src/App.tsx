import { useEffect, useState } from "react";

type Health = { status: string; db: string };

// F-01 placeholder: proves the UI -> API -> database path. Real screens arrive with F-08a/F-08b.
export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(setHealth)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui", margin: "2rem" }}>
      <h1>Queue and Service Management</h1>
      {error && <p role="alert">API unavailable: {error}</p>}
      {!error && !health && <p>Loading...</p>}
      {health && (
        <p>
          API: {health.status}, database: {health.db}
        </p>
      )}
    </main>
  );
}
