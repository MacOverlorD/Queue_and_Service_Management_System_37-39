import { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { Role } from "./api";
import { Header } from "./components/Header";
import { Loading } from "./components/Feedback";
import Login, { homeFor } from "./pages/Login";
import Queues from "./pages/Queues";
import MyTicket from "./pages/MyTicket";
import OperatorConsole from "./pages/OperatorConsole";

// Navigation only: the API still enforces every role and ownership rule.
function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) {
    return (
      <main className="card">
        <h1>Not available</h1>
        <p>This screen is not available for your role.</p>
      </main>
    );
  }
  return <>{children}</>;
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return <Navigate to={user ? homeFor(user.role) : "/login"} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/queues" element={<RequireRole role="CUSTOMER"><Queues /></RequireRole>} />
          <Route path="/my-ticket" element={<RequireRole role="CUSTOMER"><MyTicket /></RequireRole>} />
          <Route path="/operator" element={<RequireRole role="OPERATOR"><OperatorConsole /></RequireRole>} />
          <Route path="*" element={<Home />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
