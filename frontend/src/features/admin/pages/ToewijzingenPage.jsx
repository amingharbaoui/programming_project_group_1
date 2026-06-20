import { useEffect, useState, useCallback } from "react";
import { IconAlertTriangle, IconCircleCheck, IconLink, IconPencil, IconX } from "@tabler/icons-react";
import "./ToewijzingenPage.css";
import "../../../index.css";
import api from "../../../services/api";
import { cacheGet, cacheSet, cacheDelete } from "../adminCache";

const STATUS_LABELS = {
  wacht_op_student:              "Wacht op student",
  wacht_op_bedrijf:              "Wacht op bedrijf",
  in_controle_bij_administratie: "In controle",
  document_afgekeurd:            "Document afgekeurd",
  geregistreerd:                 "Geregistreerd",
  stage_loopt:                   "Stage loopt",
  resultaat_vrijgegeven:         "Resultaat vrijgegeven",
  afgerond:                      "Afgerond",
};

const STATUS_CLS = {
  wacht_op_student:              "s_amber",
  wacht_op_bedrijf:              "s_amber",
  in_controle_bij_administratie: "s_amber",
  document_afgekeurd:            "s_rood",
  geregistreerd:                 "s_ok",
  stage_loopt:                   "s_info",
  resultaat_vrijgegeven:         "s_amber",
  afgerond:                      "s_ok",
};
function statusCls(s) { return STATUS_CLS[s] || "s_amber"; }

function initials(voornaam, achternaam) {
  return [voornaam, achternaam].filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function volledigeNaam(voornaam, achternaam) {
  return `${voornaam || ""} ${achternaam || ""}`.trim() || "-";
}

export default function ToewijzingenPage() {
  const [dossiers, setDossiers] = useState([]);
  const [docenten, setDocenten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modal, setModal] = useState(null);
  const [geselecteerdeDocent, setGeselecteerdeDocent] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  const [zoek, setZoek] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [successModal, setSuccessModal] = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = useCallback((msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const load = useCallback(async () => {
    try {
      setError("");
      const cachedDos = cacheGet("admin_dossiers");
      const cachedUsr = cacheGet("admin_users");
      if (cachedDos && cachedUsr) {
        setDossiers(cachedDos);
        setDocenten(cachedUsr.filter((u) => u.hoofdrol === "docent" && u.status === "actief"));
        setLoading(false);
        return;
      }
      setLoading(true);
      const [dosRes, usrRes] = await Promise.all([
        api.get("/admin/dossiers"),
        api.get("/users"),
      ]);
      const dos = dosRes.data.data || [];
      const usr = usrRes.data.data || usrRes.data || [];
      cacheSet("admin_dossiers", dos);
      cacheSet("admin_users", usr);
      setDossiers(dos);
      setDocenten(usr.filter((u) => u.hoofdrol === "docent" && u.status === "actief"));
    } catch (err) {
      setError(err.response?.data?.message || "Gegevens ophalen mislukt");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openModal(dossier) {
    const huidig = dossier.stagebegeleider_id ? String(dossier.stagebegeleider_id) : "";
    setGeselecteerdeDocent(huidig);
    setModalError("");
    setModal({ dossier });
  }

  async function doKoppelen() {
    if (!geselecteerdeDocent) { setModalError("Kies een docent."); return; }
    setActionLoading(true);
    try {
      await api.patch(`/admin/dossiers/${modal.dossier.id}/assign`, {
        stagebegeleiderId: Number(geselecteerdeDocent),
      });
      cacheDelete("admin_dossiers");
      setModal(null);
      load();
      setSuccessModal(true);
    } catch (err) {
      showToast(err.response?.data?.message || "Koppelen mislukt", "error");
    } finally {
      setActionLoading(false);
    }
  }

  const heeftBegeleider = (d) => !!(d.docent_voornaam || d.docent_achternaam || d.stagebegeleider_id);

  const matchZoekFilter = (d) => {
    const z = zoek.toLowerCase();
    if (!z) return true;
    const naam = volledigeNaam(d.student_voornaam, d.student_achternaam).toLowerCase();
    const bedrijf = (d.bedrijf_naam || "").toLowerCase();
    return naam.includes(z) || bedrijf.includes(z);
  };

  const matchStatusFilter = (d) => !filterStatus || d.status === filterStatus;

  const zonder = dossiers.filter((d) => !heeftBegeleider(d) && matchZoekFilter(d) && matchStatusFilter(d));
  const met    = dossiers.filter((d) =>  heeftBegeleider(d) && matchZoekFilter(d) && matchStatusFilter(d));

  return (
    <div className="page">
      <div className="page_header">
        <h1>
          Toewijzingen
          {zonder.length > 0 && (
            <span className="tw_badge">{zonder.length} zonder begeleider</span>
          )}
        </h1>
        <p>Koppel een docent als stagebegeleider aan elke student. De docent krijgt daarna toegang tot het dossier.</p>
      </div>

      <div className="dos_filters">
        <input
          className="dos_zoek"
          placeholder="Zoek op student of stagebedrijf..."
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
        />
        <select
          className="dos_select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">Alle statussen</option>
          <option value="wacht_op_student">Wacht op student</option>
          <option value="wacht_op_bedrijf">Wacht op bedrijf</option>
          <option value="in_controle_bij_administratie">In controle</option>
          <option value="document_afgekeurd">Document afgekeurd</option>
          <option value="geregistreerd">Geregistreerd</option>
          <option value="stage_loopt">Stage loopt</option>
          <option value="resultaat_vrijgegeven">Resultaat vrijgegeven</option>
          <option value="afgerond">Afgerond</option>
        </select>
        {(filterStatus || zoek) && (
          <button className="btn sm primary" onClick={() => { setFilterStatus(""); setZoek(""); }}>
            <IconX size={16} stroke={1.8} />
            Wis filters
          </button>
        )}
      </div>

      {loading && <div className="card tw_state">Toewijzingen laden...</div>}
      {!loading && error && <div className="card tw_state tw_state_error">{error}</div>}
      {!loading && !error && dossiers.length === 0 && (
        <div className="card tw_empty">
          <IconLink size={16} stroke={1.8} />
          <h2>Geen dossiers</h2>
          <p>Er zijn nog geen stagedossiers aangemaakt.</p>
        </div>
      )}

      {!loading && !error && zonder.length > 0 && (
        <div className="card tw_card">
          <div className="tw_section_title">
            <IconAlertTriangle size={16} stroke={1.8} />
            Nog geen stagebegeleider toegewezen
          </div>
          <table className="tbl tw_tbl">
            <thead>
              <tr>
                <th>Student</th>
                <th>Stagebedrijf</th>
                <th>Dossiernummer</th>
                <th>Status dossier</th>
                <th style={{ textAlign: "right" }}>Actie</th>
              </tr>
            </thead>
            <tbody>
              {zonder.map((d) => (
                <tr key={d.id} className="tw_row_urgent">
                  <td>
                    <div className="tw_student_cell">
                      <div className="tw_avatar">{initials(d.student_voornaam, d.student_achternaam)}</div>
                      <div className="tw_student_info">
                        <div className="tw_naam">{volledigeNaam(d.student_voornaam, d.student_achternaam)}</div>
                        <div className="tw_sub">{d.opleiding || d.academiejaar || "-"}</div>
                      </div>
                    </div>
                  </td>
                  <td><div className="tw_cell">{d.bedrijf_naam || "-"}</div></td>
                  <td><div className="tw_cell_muted">{d.dossiernummer || "-"}</div></td>
                  <td><span className={`status ${statusCls(d.status)}`}>{STATUS_LABELS[d.status] || d.status}</span></td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn sm primary" onClick={() => openModal(d)}>
                      <IconLink size={16} stroke={1.8} />
                      Koppelen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && met.length > 0 && (
        <div className="card tw_card">

          <table className="tbl tw_tbl">
            <thead>
              <tr>
                <th>Student</th>
                <th>Stagebedrijf</th>
                <th>Stagebegeleider</th>
                <th>Dossiernummer</th>
                <th>Status dossier</th>
                <th style={{ textAlign: "right" }}>Actie</th>
              </tr>
            </thead>
            <tbody>
              {met.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div className="tw_student_cell">
                      <div className="tw_avatar">{initials(d.student_voornaam, d.student_achternaam)}</div>
                      <div className="tw_student_info">
                        <div className="tw_naam">{volledigeNaam(d.student_voornaam, d.student_achternaam)}</div>
                        <div className="tw_sub">{d.opleiding || d.academiejaar || "-"}</div>
                      </div>
                    </div>
                  </td>
                  <td><div className="tw_cell">{d.bedrijf_naam || "-"}</div></td>
                  <td>
                    <div className="tw_docent_cell">
                      <div className="tw_docent_avatar">{initials(d.docent_voornaam, d.docent_achternaam)}</div>
                      <div className="tw_naam">{volledigeNaam(d.docent_voornaam, d.docent_achternaam)}</div>
                    </div>
                  </td>
                  <td><div className="tw_cell_muted">{d.dossiernummer || "-"}</div></td>
                  <td><span className={`status ${statusCls(d.status)}`}>{STATUS_LABELS[d.status] || d.status}</span></td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn sm" onClick={() => openModal(d)}>
                      <IconPencil size={16} stroke={1.8} />
                      Wijzigen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="modal_overlay" onClick={() => setModal(null)}>
          <div className="modal_box" onClick={(e) => e.stopPropagation()}>
            <div className="modal_header">
              <span className="modal_title">
                {heeftBegeleider(modal.dossier) ? "Stagebegeleider wijzigen" : "Stagebegeleider koppelen"}
              </span>
              <button className="icon_close" onClick={() => setModal(null)}>
                <IconX size={16} stroke={1.8} />
              </button>
            </div>
            <div className="modal_body">
              <div className="kv">
                <span className="k">Student</span>
                <span className="v">{volledigeNaam(modal.dossier.student_voornaam, modal.dossier.student_achternaam)}</span>
              </div>
              <div className="kv">
                <span className="k">Stagebedrijf</span>
                <span className="v">{modal.dossier.bedrijf_naam || "-"}</span>
              </div>
              {heeftBegeleider(modal.dossier) && (
                <div className="kv">
                  <span className="k">Huidige begeleider</span>
                  <span className="v">{volledigeNaam(modal.dossier.docent_voornaam, modal.dossier.docent_achternaam)}</span>
                </div>
              )}
              <div className="modal_field" style={{ marginTop: 12 }}>
                <label className="modal_label">
                  Docent <span className="modal_required">*</span>
                </label>
                <select
                  className="tw_modal_select"
                  value={geselecteerdeDocent}
                  onChange={(e) => { setGeselecteerdeDocent(e.target.value); setModalError(""); }}
                >
                  <option value="">- kies docent -</option>
                  {docenten.map((doc) => (
                    <option key={doc.id} value={String(doc.id)}>
                      {volledigeNaam(doc.voornaam, doc.achternaam)}
                    </option>
                  ))}
                </select>
                {modalError && <span className="modal_error">{modalError}</span>}
              </div>
            </div>
            <div className="modal_footer">
              <button className="btn" onClick={() => setModal(null)}>Annuleren</button>
              <button className="btn primary" onClick={doKoppelen} disabled={actionLoading}>
                <IconLink size={16} stroke={1.8} />
                {actionLoading ? "Bezig..." : heeftBegeleider(modal.dossier) ? "Opslaan" : "Koppelen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {successModal && (
        <div className="modal_overlay" onClick={() => setSuccessModal(false)}>
          <div className="modal_box modal_box_sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal_header">
              <span>Stagebegeleider gekoppeld</span>
              <button className="icon_close" onClick={() => setSuccessModal(false)}>
                <IconX size={16} stroke={1.8} />
              </button>
            </div>
            <div className="modal_body">
              <p style={{ margin: 0, fontSize: 14, color: "var(--dark)" }}>
                De stagebegeleider is succesvol gekoppeld aan het dossier.
              </p>
            </div>
            <div className="modal_footer">
              <button className="btn primary" onClick={() => setSuccessModal(false)}>OK</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`dd_toast ${toast.type === "error" ? "dd_toast_error" : ""}`}>
          <i className={`ti ${toast.type === "error" ? "ti-x" : "ti-check"}`} style={{ fontSize: 14 }} />
          {toast.msg}
        </div>
      )}
    </div>
  );
}
