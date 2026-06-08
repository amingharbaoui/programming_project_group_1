import { Link } from "react-router-dom";
import { NAVIGATION } from "../../constants/navigation";
import { useAuth } from "../../context/AuthContext";

export default function Sidebar() {
  const { user } = useAuth();
  const items = NAVIGATION[user.role] || [];

  return (
    <aside style={{ width: "240px", minHeight: "100vh", borderRight: "1px solid #ddd", padding: "20px" }}>
      <h2>Stageify</h2>
      <p style={{ fontSize: "14px", color: "#666" }}>{user.role}</p>

      <nav style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px" }}>
        {items.map((item) => (
          <Link key={item.path} to={item.path}>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
