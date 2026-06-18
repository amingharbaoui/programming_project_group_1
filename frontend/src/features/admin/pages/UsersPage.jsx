import { useEffect, useState } from "react";
import "./UsersPage.css";
import "../../../index.css";
import { IconX, IconLoader2, IconEdit } from "@tabler/icons-react";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";

function BevestigingModal({ rawUser, onClose, onBevestigd }) {
  const [loading, setLoading] = useState(false);
  const isActief = rawUser.status === "actief";

  async function handleBevestig() {
    setLoading(true);
    try {
      await onBevestigd();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal_overlay modal_overlay_top" onClick={onClose}>
      <div className="modal_box modal_box_sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal_header">
          <span className="modal_title">
            {isActief ? "Deactiveren bevestigen" : "Heractiveren bevestigen"}
          </span>
          <button className="icon_btn" onClick={onClose} type="button">
            <IconX size={16} stroke={1.8} />
          </button>
        </div>
        <div className="modal_body">
          <p style={{ margin: 0, fontSize: 14, color: "var(--dark)" }}>
            {isActief ? (
              <>Ben je zeker dat je <strong>{rawUser.voornaam} {rawUser.achternaam}</strong> wil deactiveren? De gebruiker kan daarna niet meer aanmelden.</>
            ) : (
              <>Ben je zeker dat je <strong>{rawUser.voornaam} {rawUser.achternaam}</strong> opnieuw wil activeren?</>
            )}
          </p>
        </div>
        <div className="modal_footer">
          <button className="btn" onClick={onClose} type="button" disabled={loading}>
            Annuleren
          </button>
          <button
            className={`btn ${isActief ? "btn-danger-solid" : "btn-success-solid"}`}
            onClick={handleBevestig}
            disabled={loading}
            type="button"
          >
            {loading ? <IconLoader2 size={16} stroke={1.8} className="spin" /> : null}
            {isActief ? "Deactiveren" : "Heractiveren"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WijzigenModal({ rawUser, koppeling, onClose, onSaved, onDeactiveerClick }) {
  const [form, setForm] = useState({
    voornaam: rawUser.voornaam || "",
    achternaam: rawUser.achternaam || "",
    email: rawUser.email || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    setSaving(true);
    setErr("");
    try {
      await api.patch(`/users/${rawUser.id}`, {
        voornaam: form.voornaam,
        achternaam: form.achternaam,
        email: form.email,
      });
      onSaved();
    } catch (e) {
      setErr(e.response?.data?.message || "Wijzigen mislukt");
    } finally {
      setSaving(false);
    }
  }

  const initialen = `${rawUser.voornaam?.[0] || ""}${rawUser.achternaam?.[0] || ""}`.toUpperCase();
  const isActief = rawUser.status === "actief";

  return (
    <div className="modal_overlay" onClick={onClose}>
      <div className="modal_box" onClick={(e) => e.stopPropagation()}>
        <div className="modal_header">
          <span className="modal_title">Gebruiker wijzigen</span>
          <button className="icon_btn" onClick={onClose} type="button">
            <IconX size={16} stroke={1.8} />
          </button>
        </div>

        <div className="user_modal_info">
          <div className="user_avatar">{initialen}</div>
          <div className="user_modal_meta">
            <p className="user_modal_naam">{rawUser.voornaam} {rawUser.achternaam}</p>
            <span className={`badge role-${rawUser.hoofdrol?.toLowerCase().replace(/\s+/g, "-")}`}>
              {rawUser.hoofdrol}
            </span>
          </div>
        </div>

        <div className="modal_body">
          <div className="modal_row">
            <div className="modal_field">
              <label>Voornaam</label>
              <input
                type="text"
                value={form.voornaam}
                onChange={(e) => set("voornaam", e.target.value)}
              />
            </div>
            <div className="modal_field">
              <label>Achternaam</label>
              <input
                type="text"
                value={form.achternaam}
                onChange={(e) => set("achternaam", e.target.value)}
              />
            </div>
          </div>

          <div className="modal_field">
            <label>E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>

          <div className="modal_field">
            <label>Koppeling</label>
            <input type="text" value={koppeling} disabled className="input_disabled" />
          </div>

          {err && <p className="modal_error">{err}</p>}
        </div>

        <div className="modal_footer modal_footer_spread">
          <button
            className={`btn ${isActief ? "btn-danger" : "btn-success"}`}
            onClick={onDeactiveerClick}
            type="button"
            disabled={saving}
          >
            {isActief ? "Deactiveren" : "Heractiveren"}
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={onClose} type="button" disabled={saving}>
              Annuleren
            </button>
            <button
              className="btn primary"
              onClick={handleSubmit}
              disabled={saving}
              type="button"
            >
              {saving ? <IconLoader2 size={16} stroke={1.8} className="spin" /> : null}
              Opslaan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [wijzigenTarget, setWijzigenTarget] = useState(null);
  const [bevestigTarget, setBevestigTarget] = useState(null);

  useEffect(() => {
    loadUsers();
  }, [user.id]);

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

  async function handleStatusToggle() {
    const actie = bevestigTarget.status === "actief" ? "deactivate" : "reactivate";
    await api.patch(`/users/${bevestigTarget.id}/${actie}`);
    setBevestigTarget(null);
    setWijzigenTarget(null);
    loadUsers();
  }

  function formatUser(user) {
    return {
      id: user.id,
      naam: `${user.voornaam || ""} ${user.achternaam || ""}`.trim() || "Onbekende gebruiker",
      email: user.email,
      rol: user.hoofdrol,
      status: user.status,
      koppeling: user.koppeling || "-",
    };
  }

  return (
    <>
      {wijzigenTarget && (
        <WijzigenModal
          rawUser={wijzigenTarget}
          koppeling={wijzigenTarget.koppeling || "-"}
          onClose={() => setWijzigenTarget(null)}
          onSaved={() => { setWijzigenTarget(null); loadUsers(); }}
          onDeactiveerClick={() => setBevestigTarget(wijzigenTarget)}
        />
      )}

      {bevestigTarget && (
        <BevestigingModal
          rawUser={bevestigTarget}
          onClose={() => setBevestigTarget(null)}
          onBevestigd={handleStatusToggle}
        />
      )}

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
                <tr><td colSpan="6">Gebruikers laden...</td></tr>
              )}
              {!loading && error && (
                <tr><td colSpan="6">{error}</td></tr>
              )}
              {!loading && !error && users.length === 0 && (
                <tr><td colSpan="6">Geen gebruikers gevonden.</td></tr>
              )}
              {!loading && !error && users.map((rawUser) => {
                const u = formatUser(rawUser);
                return (
                  <tr key={u.id}>
                    <td className="user-name">{u.naam}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge role-${u.rol.toLowerCase().replace(/\s+/g, "-")}`}>
                        {u.rol}
                      </span>
                    </td>
                    <td>{u.status}</td>
                    <td>{u.koppeling}</td>
                    <td>
                      <button className="btn sm" onClick={() => setWijzigenTarget(rawUser)}>
                        <IconEdit size={13} stroke={1.8} />
                        Wijzigen
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
