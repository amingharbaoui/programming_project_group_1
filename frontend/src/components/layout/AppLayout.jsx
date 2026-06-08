import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppLayout() {
  return (
    <div style={{ display: "flex" }}>
      <Sidebar />

      <div style={{ flex: 1 }}>
        <Topbar />

        <main style={{ padding: "24px" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
