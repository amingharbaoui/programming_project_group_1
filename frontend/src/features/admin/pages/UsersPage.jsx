import { useEffect, useState } from "react";
import "./UsersPage.css";
import "../../../index.css";
import { IconUserPlus } from "@tabler/icons-react";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadUsers() {
      try {
        setLoading(true);
        setError("");
        const response = await api.get("/users");
        setUsers(response.data.data || []);
      } catch (err) {
        setError(err.response?.data?.message || "Gebruikers ophalen mislukt");
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, [user.id]);

  async function reload() {
    try {
      const response = await api.get("/users");
      setUsers(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Gebruikers ophalen mislukt");
    }
  }

  async function toggleStatus(rawUser) {
    const actie = rawUser.status === "actief" ? "deactivate" : "reactivate";
    setError("");
    try {
      await api.patch(`/users/${rawUser.id}/${actie}`);
      reload();
    } catch (err) {
      setError(err.response?.data?.message || "Status wijzigen mislukt");
    }
  }

  function formatUser(user) {
    return {
      id: user.id,
      naam: `${user.voornaam || ""} ${user.achternaam || ""}`.trim() || "Onbekende gebruiker",
      email: user.email,
      rol: user.hoofdrol,
      status: user.status,
      koppeling: user.hoofdrol === "administratie" ? "Beheerder" : "-"
    };
  }

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
            {loading && (
              <tr>
                <td colSpan="6">Gebruikers laden...</td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td colSpan="6">{error}</td>
              </tr>
            )}

            {!loading && !error && users.length === 0 && (
              <tr>
                <td colSpan="6">Geen gebruikers gevonden.</td>
              </tr>
            )}

            {!loading && !error && users.map((rawUser) => {
              const user = formatUser(rawUser);

              return (
                  <tr key={user.id}>
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
                      <button
                        className="btn sm"
                        onClick={() => toggleStatus(rawUser)}
                      >
                        {user.status === "actief" ? "Deactiveren" : "Heractiveren"}
                      </button>
                    </td>
                  </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      </div>
  );
}
