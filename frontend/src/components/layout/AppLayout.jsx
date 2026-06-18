import "./AppLayout.css";
import { useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { useAuth } from "../../context/AuthContext";

export default function AppLayout() {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  // Beveiliging: zonder ingelogde gebruiker geen toegang tot de app.
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="main">
      <Sidebar collapsed={collapsed} />

      <div className="content-wrap">
        <Navbar onToggle={() => setCollapsed((c) => !c)} />

        <main className="page-scroll">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
