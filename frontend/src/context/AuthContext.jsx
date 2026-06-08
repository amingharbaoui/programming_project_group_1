import { createContext, useContext, useState } from "react";
import { ROLES } from "../constants/roles";

const AuthContext = createContext(null);

const demoUsers = {
  student: {
    id: 1,
    name: "Demo Student",
    role: ROLES.STUDENT,
  },
  stagecommissie: {
    id: 2,
    name: "Demo Stagecommissie",
    role: ROLES.COMMITTEE,
  },
  administratie: {
    id: 3,
    name: "Demo Administratie",
    role: ROLES.ADMIN,
  },
  mentor: {
    id: 4,
    name: "Demo Mentor",
    role: ROLES.MENTOR,
  },
  docent: {
    id: 5,
    name: "Demo Docent",
    role: ROLES.TEACHER,
  },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(demoUsers.student);

  function switchRole(role) {
    setUser(demoUsers[role]);
  }

  return (
    <AuthContext.Provider value={{ user, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
