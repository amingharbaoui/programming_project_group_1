import "./Navbar.css";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { NAVIGATION } from "../../constants/navigation";
import NotificationBell from "./NotificationBell";

export default function Navbar({ onToggle }) {
  const { user, logout } = useAuth();
  const location  = useLocation();
  const navigate  = useNavigate();
  const [profielOpen, setProfielOpen] = useState(false);
  const profielRef = useRef(null);

  const items = NAVIGATION[user.role] || [];
  const currentItem = items.find((item) => location.pathname.startsWith(item.path));
  const pageTitle = currentItem?.label || "Stageify";

  const initials = user.name
    ? user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  // Sluit paneel bij klik buiten
  useEffect(() => {
    function onDocClick(e) {
      if (profielRef.current && !profielRef.current.contains(e.target)) {
        setProfielOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="topbar">
      <button className="icon-btn" onClick={onToggle} aria-label="Sidebar wisselen">
        <i className="ti ti-menu-2"></i>
      </button>

      <span className="topbar-title">{pageTitle}</span>

      <NotificationBell />

      {/* Profielpaneel */}
      <div className="profiel-wrap" ref={profielRef}>
        <div className="topbar-user" onClick={() => setProfielOpen((o) => !o)}>
          <div className="avatar">{initials}</div>
          <div className="user-info">
            <div className="name">{user.name}</div>
            <div className="role">{user.role}</div>
          </div>
          <i className="ti ti-chevron-down profiel-chevron"></i>
        </div>

        {profielOpen && (
          <div className="profiel-panel">
            <div className="profiel-header">
              <div className="profiel-avatar">{initials}</div>
              <div>
                <div className="profiel-naam">{user.name}</div>
                <div className="profiel-rol">{user.role}</div>
              </div>
            </div>
            <div className="pp-rij pp-rij--static">
              <i className="ti ti-info-circle"></i>Stagify · versie 1.0
            </div>
            <button className="profiel-logout" onClick={handleLogout}>
              <i className="ti ti-logout"></i>
              Uitloggen
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
