import "./AppLayout.css";
import { useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { useAuth } from "../../context/AuthContext";
import FlowPopups from "./FlowPopups";

const PAD_ROL = [
  { prefix: "/student", rol: "student" },
  { prefix: "/committee", rol: "stagecommissie" },
  { prefix: "/admin", rol: "administratie" },
  { prefix: "/docent", rol: "docent" },
  { prefix: "/mentor", rol: "mentor" },
];
const ROL_HOME = {
  student: "/student/internship",
  stagecommissie: "/committee/applications",
  administratie: "/admin/dossiers",
  docent: "/docent/students",
  mentor: "/mentor/students",
};

export default function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // Beveiliging: zonder ingelogde gebruiker geen toegang tot de app.
  if (!user) return <Navigate to="/login" replace />;

  // Rolbeveiliging: een gebruiker mag enkel de pagina's van de eigen rol openen.
  const vereist = PAD_ROL.find((p) => location.pathname.startsWith(p.prefix));
  if (vereist && user.role !== vereist.rol) {
    return <Navigate to={ROL_HOME[user.role] || "/login"} replace />;
  }

  return (
    <div className="main">
      <Sidebar collapsed={collapsed} />

      <div className="content-wrap">
        <Navbar onToggle={() => setCollapsed((c) => !c)} />

        <main className="page-scroll">
          <FlowPopups />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
