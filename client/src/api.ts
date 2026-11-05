export type Role = "CUSTOMER" | "OPERATOR";
export type EntryStatus = "WAITING" | "CALLED" | "SERVING" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

export type User = { id: number; name: string; email: string; role: Role };
export type QueueSummary = { id: number; name: string; serviceName: string; isOpen: boolean; waitingCount: number };
export type Ticket = {
  id: number;
  queueId: number;
  queueName: string;
  number: number;
  status: EntryStatus;
  peopleAhead: number | null;
  createdAt: string;
};

// Every API error has the shared shape { error: { code, message } } (Sprint 1 conventions).
export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: "include",
      ...init,
      headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
    });
  } catch {
    throw new ApiRequestError(0, "NETWORK_ERROR", "Cannot reach the server. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const error = body?.error;
    throw new ApiRequestError(res.status, error?.code ?? "UNKNOWN", error?.message ?? "Something went wrong.");
  }
  return body as T;
}

export const api = {
  me: () => request<{ user: User }>("/api/auth/me").then((r) => r.user),
  login: (email: string, password: string) =>
    request<{ user: User }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }).then(
      (r) => r.user,
    ),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  listQueues: () => request<{ queues: QueueSummary[] }>("/api/queues").then((r) => r.queues),
  joinQueue: (queueId: number) =>
    request<{ entry: Ticket }>(`/api/queues/${queueId}/entries`, { method: "POST" }).then((r) => r.entry),
  myActiveTickets: () => request<{ entries: Ticket[] }>("/api/me/entries?status=active").then((r) => r.entries),
};
