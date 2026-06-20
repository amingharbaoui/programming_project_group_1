import { useEffect, useState } from "react";
import "./UsersPage.css";
import "../../../index.css";
import { IconX, IconLoader2, IconEdit, IconUserPlus, IconSend } from "@tabler/icons-react";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { cacheGet, cacheSet, cacheDelete } from "../adminCache";

function BevestigingModal({ rawUser, onClose, onBevestigd }) {
  const [loading, setLoading] = useState(false);
  const isActief = rawUser.status === "actief";

  async function handleBevestig() {
    setLoading(true);
    try { await onBevestigd(); } finally { setLoading(false); }
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
          <button className="btn" onClick={onClose} type="button" disabled={loading}>Annuleren</button>
          <button
            className={`btn ${isActief ? "btn-danger-solid" : "btn-success-solid"}`}
            onClick={handleBevestig} disabled={loading} type="button"
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
    hoofdrol: rawUser.hoofdrol || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const isActief = rawUser.status === "actief";

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit() {
    setSaving(true); setErr("");
    try {
      await api.patch(`/users/${rawUser.id}`, {
        voornaam: form.voornaam,
        achternaam: form.achternaam,
        email: form.email,
        hoofdrol: form.hoofdrol,
      });
      onSaved();
    } catch (e) {
      setErr(e.response?.data?.message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

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
          <div className="user_modal_avatar">{(rawUser.voornaam?.[0] || "")}{(rawUser.achternaam?.[0] || "")}</div>
          <div className="user_modal_meta">
            <p className="user_modal_naam">{rawUser.voornaam} {rawUser.achternaam}</p>
            <p className="user_modal_koppeling">{koppeling}</p>
          </div>
        </div>
        <div className="modal_body">
          <div className="modal_row">
            <div className="modal_field">
              <label className="modal_label">Voornaam</label>
              <input className="modal_input" value={form.voornaam} onChange={(e) => set("voornaam", e.target.value)} />
            </div>
            <div className="modal_field">
              <label className="modal_label">Achternaam</label>
              <input className="modal_input" value={form.achternaam} onChange={(e) => set("achternaam", e.target.value)} />
            </div>
          </div>
          <div className="modal_field">
            <label className="modal_label">E-mail</label>
            <input className="modal_input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="modal_field">
            <label className="modal_label">Rol</label>
            <select className="modal_input" value={form.hoofdrol} onChange={(e) => set("hoofdrol", e.target.value)}>
              <option value="student">student</option>
              <option value="docent">docent</option>
              <option value="mentor">mentor</option>
              <option value="administratie">administratie</option>
              <option value="stagecommissie">stagecommissie</option>
            </select>
          </div>
          {err && <p className="modal_error">{err}</p>}
        </div>
        <div className="modal_footer" style={{ justifyContent: "space-between" }}>
          <button
            className={`btn ${isActief ? "btn-danger" : "btn-success"}`}
            onClick={onDeactiveerClick} type="button" disabled={saving}
          >
            {isActief ? "Deactiveren" : "Heractiveren"}
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={onClose} type="button" disabled={saving}>Annuleren</button>
            <button className="btn primary" onClick={handleSubmit} disabled={saving} type="button">
              {saving ? <IconLoader2 size={16} stroke={1.8} className="spin" /> : null}
              Opslaan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MentorUitnodigingModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ voornaam: "", achternaam: "", email: "", bedrijfNaam: "", functie: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleSubmit() {
    if (!form.voornaam || !form.achternaam || !form.email || !form.bedrijfNaam) {
      setErr("Voornaam, achternaam, e-mail en bedrijf zijn verplicht."); return;
    }
    setSaving(true); setErr("");
    try {
      await api.post("/admin/invitations", {
        voornaam: form.voornaam,
        achternaam: form.achternaam,
        email: form.email,
        bedrijfNaam: form.bedrijfNaam,
        functie: form.functie || "Mentor",
      });
      onSaved();
    } catch (e) {
      setErr(e.response?.data?.message || "Uitnodigen mislukt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal_overlay" onClick={onClose}>
      <div className="modal_box" onClick={(e) => e.stopPropagation()}>
        <div className="modal_header">
          <span className="modal_title">Stagementor uitnodigen</span>
          <button className="icon_btn" onClick={onClose} type="button"><IconX size={16} stroke={1.8} /></button>
        </div>
        <div className="modal_body">
          <div className="modal_row">
            <div className="modal_field">
              <label className="modal_label">Voornaam <span className="modal_required">*</span></label>
              <input className="modal_input" value={form.voornaam} onChange={(e) => set("voornaam", e.target.value)} />
            </div>
            <div className="modal_field">
              <label className="modal_label">Achternaam <span className="modal_required">*</span></label>
              <input className="modal_input" value={form.achternaam} onChange={(e) => set("achternaam", e.target.value)} />
            </div>
          </div>
          <div className="modal_field">
            <label className="modal_label">E-mail <span className="modal_required">*</span></label>
            <input className="modal_input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="modal_field">
            <label className="modal_label">Bedrijf <span className="modal_required">*</span></label>
            <input className="modal_input" placeholder="Naam van het stagebedrijf" value={form.bedrijfNaam} onChange={(e) => set("bedrijfNaam", e.target.value)} />
          </div>
          <div className="modal_field">
            <label className="modal_label">Functie</label>
            <input className="modal_input" placeholder="bv. Mentor, Teamleider" value={form.functie} onChange={(e) => set("functie", e.target.value)} />
          </div>
          <p style={{ fontSize: 12, color: "var(--sub)", marginTop: 8 }}>
            De mentor ontvangt een activatielink per e-mail en krijgt automatisch de rol "mentor".
          </p>
          {err && <p className="modal_error">{err}</p>}
        </div>
        <div className="modal_footer">
          <button className="btn" onClick={onClose} type="button" disabled={saving}>Annuleren</button>
          <button className="btn primary" onClick={handleSubmit} disabled={saving} type="button">
            {saving ? <IconLoader2 size={16} stroke={1.8} className="spin" /> : null}
            <IconSend size={16} stroke={1.8} />
            Uitnodiging versturen
          </button>
        </div>
      </div>
    </div>
  );
}

function AlgemeneUitnodigingModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ voornaam: "", achternaam: "", email: "", rol: "docent" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [resultaat, setResultaat] = useState(null); // { activatielink, emailStatus }

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleSubmit() {
    if (!form.voornaam || !form.achternaam || !form.email) {
      setErr("Voornaam, achternaam en e-mail zijn verplicht."); return;
    }
    setSaving(true); setErr("");
    try {
      const res = await api.post("/admin/users/invite", {
        voornaam: form.voornaam,
        achternaam: form.achternaam,
        email: form.email,
        rol: form.rol,
      });
      setResultaat(res.data?.data || {});
    } catch (e) {
      setErr(e.response?.data?.message || "Uitnodigen mislukt");
    } finally {
      setSaving(false);
    }
  }

  const volledigeLink = resultaat?.activatielink
    ? `${window.location.origin}${resultaat.activatielink}`
    : "";

  return (
    <div className="modal_overlay" onClick={onClose}>
      <div className="modal_box" onClick={(e) => e.stopPropagation()}>
        <div className="modal_header">
          <span className="modal_title">Gebruiker uitnodigen</span>
          <button className="icon_btn" onClick={onClose} type="button"><IconX size={16} stroke={1.8} /></button>
        </div>

        {!resultaat ? (
          <>
            <div className="modal_body">
              <div className="modal_row">
                <div className="modal_field">
                  <label className="modal_label">Voornaam <span className="modal_required">*</span></label>
                  <input className="modal_input" value={form.voornaam} onChange={(e) => set("voornaam", e.target.value)} />
                </div>
                <div className="modal_field">
                  <label className="modal_label">Achternaam <span className="modal_required">*</span></label>
                  <input className="modal_input" value={form.achternaam} onChange={(e) => set("achternaam", e.target.value)} />
                </div>
              </div>
              <div className="modal_field">
                <label className="modal_label">E-mail <span className="modal_required">*</span></label>
                <input className="modal_input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
              <div className="modal_field">
                <label className="modal_label">Rol <span className="modal_required">*</span></label>
                <select className="modal_input" value={form.rol} onChange={(e) => set("rol", e.target.value)}>
                  <option value="docent">docent</option>
                  <option value="administratie">administratie</option>
                  <option value="stagecommissie">stagecommissie</option>
                  <option value="student">student</option>
                </select>
              </div>
              <p style={{ fontSize: 12, color: "var(--sub)", marginTop: 8 }}>
                Een stagementor nodig je uit via "Stagementor uitnodigen" (met bedrijfsgegevens).
              </p>
              {err && <p className="modal_error">{err}</p>}
            </div>
            <div className="modal_footer">
              <button className="btn" onClick={onClose} type="button" disabled={saving}>Annuleren</button>
              <button className="btn primary" onClick={handleSubmit} disabled={saving} type="button">
                {saving ? <IconLoader2 size={16} stroke={1.8} className="spin" /> : null}
                <IconSend size={16} stroke={1.8} />
                Uitnodiging versturen
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="modal_body">
              <p style={{ margin: "0 0 10px", fontSize: 13.5, color: "var(--dark)" }}>
                <strong>{form.voornaam} {form.achternaam}</strong> is uitgenodigd als {form.rol}.
                {resultaat.emailStatus === "verzonden"
                  ? " De activatielink is per e-mail verstuurd."
                  : " Bezorg onderstaande activatielink aan de gebruiker:"}
              </p>
              {volledigeLink && (
                <div className="modal_field">
                  <label className="modal_label">Activatielink</label>
                  <input className="modal_input" readOnly value={volledigeLink} onFocus={(e) => e.target.select()} />
                  <button className="btn sm" style={{ marginTop: 6 }} type="button"
                    onClick={() => navigator.clipboard?.writeText(volledigeLink)}>
                    Kopiëren
                  </button>
                </div>
              )}
            </div>
            <div className="modal_footer">
              <button className="btn primary" onClick={onSaved} type="button">Klaar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [zoek, setZoek] = useState("");
  const [filterRol, setFilterRol] = useState("");
  const [wijzigenTarget, setWijzigenTarget] = useState(null);
  const [bevestigTarget, setBevestigTarget] = useState(null);
  const [uitnodigingOpen, setUitnodigingOpen] = useState(false);
  const [algemeenOpen, setAlgemeenOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { loadUsers(); }, [user.id]);

  async function loadUsers() {
    try {
      setError("");
      const cached = cacheGet("admin_users");
      if (cached) { setUsers(cached); setLoading(false); return; }
      setLoading(true);
      const response = await api.get("/users");
      const data = response.data.data || [];
      cacheSet("admin_users", data);
      setUsers(data);
    } catch (err) {
      setError(err.response?.data?.message || "Gebruikers ophalen mislukt");
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg, type = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleStatusToggle() {
    const actie = bevestigTarget.status === "actief" ? "deactivate" : "reactivate";
    await api.patch(`/users/${bevestigTarget.id}/${actie}`);
    cacheDelete("admin_users");
    setBevestigTarget(null);
    setWijzigenTarget(null);
    loadUsers();
  }

  function formatUser(u) {
    const voornaam = u.voornaam || "";
    const achternaam = u.achternaam || "";
    return {
      id: u.id,
      naam: `${voornaam} ${achternaam}`.trim() || "Onbekende gebruiker",
      initialen: [voornaam, achternaam].filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?",
      email: u.email,
      rol: u.hoofdrol,
      status: u.status,
      koppeling: u.koppeling || "-",
    };
  }

  return (
    <>
      {wijzigenTarget && (
        <WijzigenModal
          rawUser={wijzigenTarget}
          koppeling={wijzigenTarget.koppeling || "-"}
          onClose={() => setWijzigenTarget(null)}
          onSaved={() => { setWijzigenTarget(null); loadUsers(); showToast("Gebruiker opgeslagen."); }}
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
      {uitnodigingOpen && (
        <MentorUitnodigingModal
          onClose={() => setUitnodigingOpen(false)}
          onSaved={() => {
            setUitnodigingOpen(false);
            loadUsers();
            showToast("Mentor uitgenodigd — activatielink verstuurd.");
          }}
        />
      )}
      {algemeenOpen && (
        <AlgemeneUitnodigingModal
          onClose={() => setAlgemeenOpen(false)}
          onSaved={() => {
            setAlgemeenOpen(false);
            loadUsers();
            showToast("Gebruiker uitgenodigd.");
          }}
        />
      )}

      <div className="users-page">
        <div className="page_header">
          <div className="page_title_wrap">
            <div>
              <h1>Gebruikers</h1>
              <p>Beheer gebruikers, rollen en koppelingen binnen het stageplatform.</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => setAlgemeenOpen(true)}>
                <IconUserPlus size={14} stroke={2} />
                Gebruiker uitnodigen
              </button>
              <button className="btn primary" onClick={() => setUitnodigingOpen(true)}>
                <IconUserPlus size={14} stroke={2} />
                Stagementor uitnodigen
              </button>
            </div>
          </div>
        </div>

        <div className="dos_filters">
          <input
            className="dos_zoek"
            placeholder="Zoek op naam of e-mail..."
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
          />
          <select
            className="dos_select"
            value={filterRol}
            onChange={(e) => setFilterRol(e.target.value)}
          >
            <option value="">Alle rollen</option>
            <option value="student">Student</option>
            <option value="docent">Docent</option>
            <option value="mentor-extern">Mentor</option>
            <option value="administratie">Administratie</option>
            <option value="stagecommissie">Stagecommissie</option>
          </select>
          {(filterRol || zoek) && (
            <button className="btn sm primary" onClick={() => { setFilterRol(""); setZoek(""); }}>
              <IconX size={16} stroke={1.8} />
              Wis filters
            </button>
          )}
        </div>

        <div className="card users_card">
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
              {loading && <tr><td colSpan="6">Gebruikers laden...</td></tr>}
              {!loading && error && <tr><td colSpan="6" style={{ color: "var(--red)" }}>{error}</td></tr>}
              {!loading && !error && users.length === 0 && <tr><td colSpan="6">Geen gebruikers gevonden.</td></tr>}
              {!loading && !error && users.filter((rawUser) => {
                const z = zoek.toLowerCase();
                const naam = `${rawUser.voornaam || ""} ${rawUser.achternaam || ""}`.toLowerCase();
                const email = (rawUser.email || "").toLowerCase();
                const matchZoek = !z || naam.includes(z) || email.includes(z);
                const matchRol = !filterRol || (rawUser.hoofdrol || "").toLowerCase() === filterRol;
                return matchZoek && matchRol;
              }).map((rawUser) => {
                const u = formatUser(rawUser);
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="tw_student_cell">
                        <div className="tw_avatar">{u.initialen}</div>
                        <div className="tw_student_info">
                          <div className="tw_naam">{u.naam}</div>
                        </div>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge role-${u.rol.toLowerCase().replace(/\s+/g, "-")}`}>{u.rol}</span>
                    </td>
                    <td>
                      {u.status === "inactief"
                        ? <span style={{ color: "var(--red)" }}>inactief</span>
                        : u.status === "actief"
                        ? <span style={{ color: "var(--green)" }}>actief</span>
                        : <span style={{ color: "var(--amber)" }}>{u.status}</span>
                      }
                    </td>
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

      {toast && (
        <div className={`dd_toast ${toast.type === "error" ? "dd_toast_error" : ""}`}>
          {toast.msg}
        </div>
      )
    }
    </>
  );
}
