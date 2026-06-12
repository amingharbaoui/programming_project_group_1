import { useAuth } from "../../context/AuthContext";
import { ROLES } from "../../constants/roles";

export default function Navbar() {
  const { user, switchRole } = useAuth();
  const selectedUserKey =
    user.role === ROLES.STUDENT && user.id !== 1 ? `student${user.id - 4}` : user.role;

  return (
    <header style={{ height: "64px", borderBottom: "1px solid #ddd", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <strong>{user.name}</strong>

      <select value={selectedUserKey} onChange={(e) => switchRole(e.target.value)}>
        <option value={ROLES.STUDENT}>Student 1</option>
        <option value="student2">Student 2</option>
        <option value="student3">Student 3</option>
        <option value="student4">Student 4</option>
        <option value={ROLES.COMMITTEE}>Stagecommissie</option>
        <option value={ROLES.ADMIN}>Administratie</option>
        <option value={ROLES.MENTOR}>Mentor</option>
        <option value={ROLES.DOCENT}>Docent</option>
      </select>
    </header>
  );
}

