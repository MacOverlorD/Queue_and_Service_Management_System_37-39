// Shared loading, error and empty states (NFR-08).
export function Loading({ label = "Loading..." }: { label?: string }) {
  return (
    <p role="status" className="muted">
      {label}
    </p>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="banner banner-error">
      {message}
    </p>
  );
}

export function EmptyState({ children }: { children: string }) {
  return <p className="empty">{children}</p>;
}
