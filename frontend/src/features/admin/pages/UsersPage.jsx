import React from "react";
import "./UsersPage.css";
import "../../../index.css";
import { IconUser, IconUserPlus, IconEye } from "@tabler/icons-react";

export default function UsersPage() {
  const users = [
    {
      naam: "Milan Peeters",
      email: "milan.peeters@student.ehb.be",
      rol: "Student",
      status: "Actief",
      koppeling: "Dossier DOS-2026-014",
    },
    {
      naam: "K. Wouters",
      email: "k.wouters@ehb.be",
      rol: "Docent",
      status: "Actief",
      koppeling: "Stagebegeleider van Milan Peeters",
    },
    {
      naam: "Sofie Maris",
      email: "sofie.maris@nodea.be",
      rol: "Mentor extern",
      status: "Uitgenodigd",
      koppeling: "Nodea Software",
    },
    {
      naam: "S. Bogaerts",
      email: "s.bogaerts@ehb.be",
      rol: "Administratie",
      status: "Actief",
      koppeling: "Beheerder",
    },
  ];

  return (
      <div className="users-page">
        <div className="page_header">
          <div className="page_title_wrap">
            <div>
              <h1>Gebruikers</h1>
              <p>Beheer gebruikers, rollen en koppelingen binnen het stageplatform.</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Gebruikersoverzicht</h2>
            <button className="btn primary">
              <IconUserPlus size={18} stroke={1.8} />
              Gebruiker toevoegen
            </button>
          </div>

          <table className="users-table">
            <thead>
            <tr>
              <th>Naam</th>
              <th>E-mail</th>
              <th>Rol</th>
              <th>Status</th>
              <th>Koppeling</th>
              <th>Actie</th>
            </tr>
            </thead>

            <tbody>
            {users.map((user, index) => (
                <tr key={index}>
                  <td className="user-name">{user.naam}</td>
                  <td>{user.email}</td>
                  <td>
                  <span className={`badge role-${user.rol.toLowerCase().replace(/\s+/g, "-")}`}>
                    {user.rol}
                  </span>
                  </td>
                  <td>{user.status}</td>
                  <td>{user.koppeling}</td>
                  <td>
                    <button className="btn sm">
                      <IconEye size={16} stroke={2} />
                      Bekijken
                    </button>
                  </td>
                </tr>
            ))}
            </tbody>
          </table>
        </div>
      </div>
  );
}