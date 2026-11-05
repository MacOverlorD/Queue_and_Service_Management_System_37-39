import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  async function onLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header className="header">
      <div className="header-inner">
        <strong className="brand">Service Queue</strong>
        <nav aria-label="Main">
          {user.role === "CUSTOMER" && (
            <>
              <NavLink to="/queues">Queues</NavLink>
              <NavLink to="/my-ticket">My tickets</NavLink>
            </>
          )}
          {user.role === "OPERATOR" && <NavLink to="/operator">Console</NavLink>}
        </nav>
        <div className="header-user">
          <span>
            {user.name} <small>({user.role === "CUSTOMER" ? "Customer" : "Operator"})</small>
          </span>
          <button type="button" className="btn btn-secondary" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
