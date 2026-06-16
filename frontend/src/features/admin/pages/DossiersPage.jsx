import { useEffect, useState } from "react";
import "./DossiersPage.css";
import "../../../index.css";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";

const STATUS_CLASSES = {
  contract_pending: "s_amber",
  documents_pending: "s_amber",
  active: "s_ok",
  completed: "s_ok",
  afgerond: "s_ok",
  resultaat_vrijgegeven: "s_info",
  goedgekeurd: "s_ok",
  afgekeurd: "s_rood",
  ingediend: "s_info",
  ontbreekt: "s_rood",
  geregistreerd: "s_ok",
};

function statusClass(status) {
  return STATUS_CLASSES[status] || "s_amber";
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("nl-BE");
}

function studentNaam(dossier) {
  return `${dossier.student_voornaam || ""} ${dossier.student_achternaam || ""}`.trim();
}

export default function DossiersPage() {
  const { user } = useAuth();
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    loadDossiers();
  }, [user.id]);

  async function loadDossiers() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/admin/dossiers");
      setDossiers(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Dossiers ophalen mislukt");
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(id) {
    try {
      setDetailLoading(true);
      setDetailError("");
      setActionMessage("");
      const response = await api.get(`/admin/dossiers/${id}`);
      setDetail(response.data.data);
    } catch (err) {
      setDetailError(err.response?.data?.message || "Dossier detail ophalen mislukt");
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshDetail() {
    if (!detail?.id) return;
    await openDetail(detail.id);
    await loadDossiers();
  }

  async function runAction(label, action) {
    try {
      setActionBusy(label);
      setActionMessage("");
      await action();
      setActionMessage("Actie uitgevoerd.");
      await refreshDetail();
    } catch (err) {
      setActionMessage(err.response?.data?.message || "Actie mislukt.");
    } finally {
      setActionBusy("");
    }
  }

  function approveDocument(documentId) {
    runAction(`approve-${documentId}`, () => api.patch(`/admin/documents/${documentId}/approve`));
  }

  function rejectDocument(documentId) {
    const reden = window.prompt("Reden van afkeuring:");
    if (!reden?.trim()) return;
    runAction(`reject-${documentId}`, () => api.patch(`/admin/documents/${documentId}/reject`, { afkeurreden: reden.trim() }));
  }

  function sendReminder() {
    runAction("reminder", () => api.post(`/admin/dossiers/${detail.id}/reminder`));
  }

  function markStartReady() {
    runAction("startklaar", () => api.patch(`/admin/dossiers/${detail.id}/startklaar`));
  }

  function generateSummary() {
    runAction("eindoverzicht", () => api.post(`/admin/dossiers/${detail.id}/eindoverzicht`));
  }

  function formatDossier(dossier) {
    const student = studentNaam(dossier);
    const docent = `${dossier.docent_voornaam || ""} ${dossier.docent_achternaam || ""}`.trim();
    const documenten = `${dossier.documenten_in_orde || 0}/${dossier.verplichte_documenten || 0} in orde`;

    return {
      id: dossier.id,
      initials: student
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "ST",
      student: student || "Onbekende student",
      opleiding: dossier.opleiding || dossier.academiejaar || "-",
      bedrijf: dossier.bedrijf_naam || "-",
      begeleider: docent || "Nog niet gekoppeld",
      begeleiderStatus: dossier.mentor_voornaam ? "Mentor gekoppeld" : "Mentor ontbreekt",
      dossiernr: dossier.dossiernummer,
      overeenkomst: dossier.overeenkomst_status || "Nog niet gestart",
      documenten,
      status: dossier.status,
    };
  }

  return (
    <div className="page">
      <div className="page_header">
        <h1>Dossiers</h1>
        <p>Controleer documenten, handtekeningen en administratieve dossierstatus.</p>
      </div>

      <div className="card dossiers_card">
        <table className="tbl dossiers_tbl">
          <thead>
            <tr>
              <th>Student</th>
              <th>Stagebedrijf</th>
              <th>Stagebegeleider</th>
              <th>Stagedossier</th>
              <th>Stageovereenkomst</th>
              <th>Documenten</th>
              <th>Status</th>
              <th className="right">Actie</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan="8">Dossiers laden...</td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td colSpan="8">{error}</td>
              </tr>
            )}

            {!loading && !error && dossiers.length === 0 && (
              <tr>
                <td colSpan="8">Geen dossiers gevonden.</td>
              </tr>
            )}

            {!loading && !error && dossiers.map((rawDossier) => {
              const dossier = formatDossier(rawDossier);

              return (
                <tr key={dossier.id}>
                  <td>
                    <div className="student_cell">
                      <div className="student_avatar">{dossier.initials}</div>
                      <div className="student_info">
                        <div className="student_name">{dossier.student}</div>
                        <div className="student_meta">{dossier.opleiding}</div>
                      </div>
                    </div>
                  </td>

                  <td><div className="cell_main">{dossier.bedrijf}</div></td>
                  <td>
                    <div className="cell_main">{dossier.begeleider}</div>
                    <div className="cell_sub">{dossier.begeleiderStatus}</div>
                  </td>
                  <td><div className="cell_dossier">{dossier.dossiernr}</div></td>
                  <td><div className="cell_main">{dossier.overeenkomst}</div></td>
                  <td><div className="cell_main">{dossier.documenten}</div></td>
                  <td><span className={`status ${statusClass(dossier.status)}`}>{dossier.status}</span></td>

                  <td className="right">
                    <button className="btn primary dossiers_action_btn" onClick={() => openDetail(dossier.id)}>
                      Controleren
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(detail || detailLoading || detailError) && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <div className="dossier-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{detail ? detail.dossiernummer : "Dossier"}</h2>
                <p>{detail ? studentNaam(detail) : "Dossier laden..."}</p>
              </div>
              <button className="btn sm" onClick={() => setDetail(null)}>Sluiten</button>
            </div>

            {detailLoading && <p className="modal-muted">Dossier laden...</p>}
            {detailError && <p className="status s_rood">{detailError}</p>}

            {detail && (
              <>
                <div className="detail-grid">
                  <div className="detail-box">
                    <span>Student</span>
                    <strong>{studentNaam(detail)}</strong>
                    <small>{detail.student_email}</small>
                  </div>
                  <div className="detail-box">
                    <span>Bedrijf</span>
                    <strong>{detail.bedrijf_naam}</strong>
                    <small>{detail.bedrijf_stad || detail.bedrijf_adres || "-"}</small>
                  </div>
                  <div className="detail-box">
                    <span>Stagebegeleider</span>
                    <strong>{`${detail.docent_voornaam || ""} ${detail.docent_achternaam || ""}`.trim() || "-"}</strong>
                    <small>{detail.docent_email || "-"}</small>
                  </div>
                  <div className="detail-box">
                    <span>Stageovereenkomst</span>
                    <strong>{detail.stageovereenkomst?.status || "Nog niet gestart"}</strong>
                    <small>
                      Student: {formatDate(detail.stageovereenkomst?.student_getekend_op)} · Bedrijf: {formatDate(detail.stageovereenkomst?.bedrijf_getekend_op)}
                    </small>
                  </div>
                </div>

                <div className="modal-actions">
                  <button className="btn" disabled={!!actionBusy} onClick={sendReminder}>
                    {actionBusy === "reminder" ? "Bezig..." : "Herinnering sturen"}
                  </button>
                  <button className="btn primary" disabled={!!actionBusy} onClick={markStartReady}>
                    {actionBusy === "startklaar" ? "Bezig..." : "Startklaar zetten"}
                  </button>
                  <button className="btn" disabled={!!actionBusy} onClick={generateSummary}>
                    {actionBusy === "eindoverzicht" ? "Bezig..." : "Eindoverzicht genereren"}
                  </button>
                </div>

                {actionMessage && (
                  <p className={`status ${actionMessage.includes("mislukt") || actionMessage.includes("nog niet") ? "s_rood" : "s_ok"}`}>
                    {actionMessage}
                  </p>
                )}

                <div className="documents-panel">
                  <div className="section-title">Documenten</div>
                  {detail.documenten.length === 0 ? (
                    <p className="modal-muted">Geen documenten gevonden.</p>
                  ) : (
                    <div className="doc-admin-list">
                      {detail.documenten.map((document) => (
                        <div className="doc-admin-row" key={document.id}>
                          <div>
                            <div className="doc-admin-name">{document.naam || document.bestand_naam || "Eigen document"}</div>
                            <div className="doc-admin-meta">
                              {document.is_verplicht ? "Verplicht" : "Eigen/optioneel"} · v{document.versie_nummer} · {formatDate(document.opgeladen_op)}
                            </div>
                            {document.afkeurreden && <div className="doc-reason">{document.afkeurreden}</div>}
                          </div>
                          <div className="doc-admin-actions">
                            <span className={`status ${statusClass(document.status)}`}>{document.status}</span>
                            {document.bestand_url && (
                              <a className="btn sm" href={document.bestand_url} target="_blank" rel="noreferrer">Bekijken</a>
                            )}
                            <button className="btn sm" disabled={!!actionBusy} onClick={() => approveDocument(document.id)}>
                              {actionBusy === `approve-${document.id}` ? "..." : "Goedkeuren"}
                            </button>
                            <button className="btn sm danger" disabled={!!actionBusy} onClick={() => rejectDocument(document.id)}>
                              {actionBusy === `reject-${document.id}` ? "..." : "Afkeuren"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
