import { useAuth } from "../../context/AuthContext";
import { ROLES } from "../../constants/roles";

export default function Topbar() {
  const { user, switchRole } = useAuth();

  return (
    <header style={{ height: "64px", borderBottom: "1px solid #ddd", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <strong>{user.name}</strong>

      <select value={user.role} onChange={(e) => switchRole(e.target.value)}>
        <option value={ROLES.STUDENT}>Student</option>
        <option value={ROLES.COMMITTEE}>Stagecommissie</option>
        <option value={ROLES.ADMIN}>Administratie</option>
        <option value={ROLES.MENTOR}>Mentor</option>
        <option value={ROLES.DOCENT}>Docent</option>
      </select>
    </header>
  );
}

