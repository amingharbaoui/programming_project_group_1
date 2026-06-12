import "./AppLayout.css";
import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);

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
