import { createContext, useContext, useState } from "react";
import { ROLES } from "../constants/roles";
import { setApiUserId } from "../services/api";

const AuthContext = createContext(null);

const demoUsers = {
  student: {
    id: 1,
    name: "Demo Student",
    role: ROLES.STUDENT,
  },
  student2: {
    id: 6,
    name: "Demo Student 2",
    role: ROLES.STUDENT,
  },
  student3: {
    id: 7,
    name: "Demo Student 3",
    role: ROLES.STUDENT,
  },
  student4: {
    id: 8,
    name: "Demo Student 4",
    role: ROLES.STUDENT,
  },
  stagecommissie: {
    id: 2,
    name: "Demo Stagecommissie",
    role: ROLES.COMMITTEE,
  },
  administratie: {
    id: 4,
    name: "Demo Administratie",
    role: ROLES.ADMIN,
  },
  mentor: {
    id: 5,
    name: "Demo Mentor",
    role: ROLES.MENTOR,
  },
  docent: {
    id: 3,
    name: "Demo Docent",
    role: ROLES.DOCENT,
  },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(demoUsers.student);

  function switchRole(roleOrUserKey) {
    const nextUser = demoUsers[roleOrUserKey] || demoUsers.student;
    setApiUserId(nextUser.id)
    setUser(nextUser);
  }

  function loginUser(apiUser) {
    const nextUser = {
      id: apiUser.id,
      name: `${apiUser.voornaam} ${apiUser.achternaam}`.trim(),
      role: apiUser.hoofdrol,
    };

    setApiUserId(nextUser.id);
    setUser(nextUser);
  }

  return (
    <AuthContext.Provider value={{ user, switchRole, loginUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

