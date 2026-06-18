import "./MentorLayout.css";
import { useState } from "react";
import { Outlet, useLocation, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const NAV = [
  { to: "/mentor/students", icon: "ti-users", label: "Mijn stagiairs" },
  { to: "/mentor/contract", icon: "ti-file-certificate", label: "Overeenkomst" },
  { to: "/mentor/afspraken", icon: "ti-clipboard-text", label: "Afspraken" },
  { to: "/mentor/planning", icon: "ti-calendar", label: "Bedrijfsbezoek" },
  { to: "/mentor/logbooks", icon: "ti-notebook", label: "Logboek" },
  { to: "/mentor/evaluation", icon: "ti-clipboard-check", label: "Evaluatie" },
];
const TITELS = [
  ["/mentor/students", "Mijn stagiairs"],
  ["/mentor/dossier", "Dossier stagiair"],
  ["/mentor/logbooks", "Logboeken"],
  ["/mentor/evaluation", "Evaluaties"],
  ["/mentor/contract", "Stageovereenkomst"],
  ["/mentor/afspraken", "Praktische afspraken"],
  ["/mentor/planning", "Planning"],
];

export default function MentorLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();

  // Beveiliging: zonder ingelogde gebruiker geen toegang.
  if (!user) return <Navigate to="/login" replace />;

  const pageTitle = (TITELS.find(([p]) => loc.pathname.startsWith(p)) || ["", "Mentor"])[1];
  const initials = (user.name || "").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

  function handleLogout() { logout(); navigate("/login"); }

  return (
    <div className="mtr-shell">
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="brand">
          <div className="brand-full">
            <div className="ehb-badge"><span>EhB</span></div>
            <div className="brand-text">
              <div className="app-name">Stagify</div>
              <div className="inst">Toegepaste Informatica</div>
            </div>
          </div>
        </div>

        <nav className="nav">
          {NAV.map((n) => (
            <div
              key={n.to}
              className={`nav-item ${loc.pathname.startsWith(n.to) ? "active" : ""}`}
              onClick={() => navigate(n.to)}
            >
              <i className={`ti ${n.icon}`} /><span className="label">{n.label}</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer"><span>Stagify · v1.0 (prototype)</span></div>
      </aside>

      <div className="content-wrap">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setCollapsed((c) => !c)} aria-label="Sidebar wisselen">
            <i className="ti ti-menu-2" />
          </button>
          <span className="topbar-title">{pageTitle}</span>

          <button className="icon-btn" aria-label="Meldingen"><i className="ti ti-bell" /><span className="bell-dot" /></button>

          <div className="topbar-user">
            <div className="avatar">{initials}</div>
            <div className="user-info">
              <div className="name">{user.name}</div>
              <div className="role">{user.role}</div>
            </div>
          </div>
          <button className="icon-btn" aria-label="Uitloggen" title="Uitloggen" onClick={handleLogout}>
            <i className="ti ti-logout" />
          </button>
        </header>

        <main className="page-scroll"><Outlet /></main>
      </div>
    </div>
  );
}
