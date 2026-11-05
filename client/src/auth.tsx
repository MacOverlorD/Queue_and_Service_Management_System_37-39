import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiRequestError, User } from "./api";

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // Call from any page when the API answers 401, so the user returns to the login screen.
  handleError: (err: unknown) => string;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On load, ask the server who we are. No session means the login screen.
  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setUser(await api.login(email, password));
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const handleError = useCallback((err: unknown) => {
    if (err instanceof ApiRequestError) {
      if (err.status === 401) setUser(null);
      return err.message;
    }
    return "Something went wrong.";
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout, handleError }), [user, loading, login, logout, handleError]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
