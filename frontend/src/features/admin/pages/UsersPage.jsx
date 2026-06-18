import { useEffect, useState } from "react";
import "./UsersPage.css";
import "../../../index.css";
import { IconUserPlus } from "@tabler/icons-react";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import Modal from "../../../components/ui/Modal";

const LEEG_INVITE = { voornaam: "", achternaam: "", email: "", bedrijfNaam: "", functie: "" };

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState(LEEG_INVITE);
  const [inviteBezig, setInviteBezig] = useState(false);
  const [inviteFout, setInviteFout] = useState("");
  const [inviteLink, setInviteLink] = useState("");

  async function verstuurInvite(e) {
    e.preventDefault();
    if (!invite.voornaam.trim() || !invite.achternaam.trim() || !invite.email.trim() || !invite.bedrijfNaam.trim()) {
      setInviteFout("Vul voornaam, achternaam, e-mail en bedrijf in.");
      return;
    }
    try {
      setInviteBezig(true);
      setInviteFout("");
      const res = await api.post("/admin/invitations", {
        voornaam: invite.voornaam.trim(),
        achternaam: invite.achternaam.trim(),
        email: invite.email.trim(),
        bedrijfNaam: invite.bedrijfNaam.trim(),
        functie: invite.functie.trim() || undefined,
      });
      setInviteLink(res.data.data?.activatielink || "");
      setInvite(LEEG_INVITE);
      reload();
    } catch (err) {
      setInviteFout(err.response?.data?.message || "Uitnodigen mislukt");
    } finally {
      setInviteBezig(false);
    }
  }

  async function opnieuwVersturen(rawUser) {
    setError("");
    try {
      await api.post(`/admin/invitations/${rawUser.id}/resend`);
      reload();
    } catch (err) {
      setError(err.response?.data?.message || "Opnieuw versturen mislukt");
    }
  }

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
            <button className="btn primary" onClick={() => { setInviteOpen(true); setInviteLink(""); setInviteFout(""); }}>
              <IconUserPlus size={18} stroke={1.8} />
              Stagementor uitnodigen
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
                      {rawUser.hoofdrol === "mentor" && rawUser.status !== "actief" && (
                        <button
                          className="btn sm"
                          style={{ marginLeft: "6px" }}
                          onClick={() => opnieuwVersturen(rawUser)}
                        >
                          Uitnodiging opnieuw
                        </button>
                      )}
                    </td>
                  </tr>
              );
            })}
            </tbody>
          </table>
        </div>

        <Modal
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          icon="ti-user-plus"
          titel="Stagementor uitnodigen"
          sub="De mentor krijgt een activatielink om een account aan te maken."
        >
          {inviteLink ? (
            <div>
              <p className="muted">Uitnodiging aangemaakt. Activatielink:</p>
              <code style={{ display: "block", wordBreak: "break-all", padding: "8px", background: "var(--muted)", borderRadius: "6px" }}>{inviteLink}</code>
              <div className="actions" style={{ marginTop: "12px" }}>
                <button className="btn primary" onClick={() => setInviteOpen(false)}>Sluiten</button>
              </div>
            </div>
          ) : (
            <form onSubmit={verstuurInvite}>
              <div className="grid_2" style={{ gap: "10px" }}>
                <label>Voornaam
                  <input type="text" value={invite.voornaam} onChange={(e) => setInvite((p) => ({ ...p, voornaam: e.target.value }))} />
                </label>
                <label>Achternaam
                  <input type="text" value={invite.achternaam} onChange={(e) => setInvite((p) => ({ ...p, achternaam: e.target.value }))} />
                </label>
                <label>E-mail
                  <input type="email" value={invite.email} onChange={(e) => setInvite((p) => ({ ...p, email: e.target.value }))} />
                </label>
                <label>Bedrijf
                  <input type="text" value={invite.bedrijfNaam} onChange={(e) => setInvite((p) => ({ ...p, bedrijfNaam: e.target.value }))} />
                </label>
                <label>Functie (optioneel)
                  <input type="text" value={invite.functie} onChange={(e) => setInvite((p) => ({ ...p, functie: e.target.value }))} />
                </label>
              </div>
              {inviteFout && <p className="status s_rood" style={{ marginTop: "10px" }}>{inviteFout}</p>}
              <div className="actions" style={{ marginTop: "14px" }}>
                <button className="btn primary" type="submit" disabled={inviteBezig}>{inviteBezig ? "Bezig..." : "Uitnodiging versturen"}</button>
                <button className="btn" type="button" onClick={() => setInviteOpen(false)}>Annuleren</button>
              </div>
            </form>
          )}
        </Modal>
      </div>
  );
}
