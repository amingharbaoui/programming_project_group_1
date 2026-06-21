import { useEffect, useState } from "react";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import "./DocentProposalsPage.css";
import { IconX, IconRefresh, IconEye } from "@tabler/icons-react";
import { cacheGet, cacheSet } from "../docentCache";

// Alle mogelijke statussen van stagevoorstellen:
// concept · ingediend · aanpassingen_gevraagd · heringediend · goedgekeurd · afgekeurd · ingetrokken
function getStatusClass(status) {
  if (status === "goedgekeurd" || status === "goedgekeurd_met_uitzondering") return "s_ok";
  if (status === "ingediend" || status === "heringediend") return "s_info";
  if (status === "aanpassingen_gevraagd") return "s_amber";
  if (status === "afgekeurd" || status === "ingetrokken") return "s_rood";
  return "s_grijs"; // concept
}

function getStatusLabel(status) {
  const labels = {
    concept:                    "Concept",
    ingediend:                  "Ingediend",
    aanpassingen_gevraagd:      "Aanpassingen gevraagd",
    heringediend:               "Heringediend",
    goedgekeurd:                "Goedgekeurd",
    goedgekeurd_met_uitzondering:"Goedgekeurd (uitzondering)",
    afgekeurd:                  "Afgekeurd",
    ingetrokken:                "Ingetrokken door student",
  };
  return labels[status] || status || "-";
}

function formatDate(v) {
  if (!v) return "-";
  return new Date(v).toLocaleDateString("nl-BE");
}

export default function DocentProposalsPage() {
  const { user } = useAuth();
  const [voorstellen, setVoorstellen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [zoek, setZoek] = useState("");
  const [filterStatus, setFilterStatus] = useState("alle");

  async function loadVoorstellen(force = false) {
    try {
      setError("");
      if (!force) {
        const cached = cacheGet("docent_proposals");
        if (cached) { setVoorstellen(cached); setLoading(false); return; }
      }
      setLoading(true);
      const res = await api.get("/docent/proposals");
      const data = res.data.data || [];
      cacheSet("docent_proposals", data);
      setVoorstellen(data);
    } catch (err) {
      setError(err.response?.data?.message || "Voorstellen ophalen mislukt");
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(v) {
    setDetail({ huidige: v, versies: [v], beslissingen: [] });
    setDetailLoading(true);
    try {
      const res = await api.get(`/docent/proposals/${v.stagevoorstel_id}`, {
      });
      setDetail(res.data.data);
    } catch {
      // val terug op het lijst-object
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadVoorstellen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const h = detail?.huidige || null;

  const STATUS_OPTIES = [
    { key: "alle", label: "Alle statussen" },
    { key: "ingediend", label: "Ingediend" },
    { key: "heringediend", label: "Heringediend" },
    { key: "aanpassingen_gevraagd", label: "Aanpassingen gevraagd" },
    { key: "goedgekeurd", label: "Goedgekeurd" },
    { key: "afgekeurd", label: "Afgekeurd" },
  ];

  const gefilterd = voorstellen.filter((v) => {
    if (zoek) {
      const q = zoek.toLowerCase();
      if (!(v.student_naam || "").toLowerCase().includes(q) &&
          !(v.bedrijf_naam || "").toLowerCase().includes(q)) return false;
    }
    if (filterStatus !== "alle" && v.voorstel_status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1>Stagevoorstellen</h1>
          <p>Voorstellen van jouw studenten — alleen-lezen (de stagecommissie beslist).</p>
        </div>
        <button className="btn primary" onClick={() => loadVoorstellen(true)}><IconRefresh size={14} stroke={1.8} /> Vernieuwen</button>
      </div>

      <div className="doc_filters" style={{ marginBottom: 16 }}>
        <input
          className="doc_zoek"
          placeholder="Zoek op student of bedrijf..."
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
        />
        <select
          className="doc_select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          {STATUS_OPTIES.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
        {(zoek || filterStatus !== "alle") && (
          <button className="btn sm primary" onClick={() => { setZoek(""); setFilterStatus("alle"); }}>
            Wis filters
          </button>
        )}
      </div>

      {loading && <div className="card"><p className="muted">Voorstellen laden...</p></div>}
      {error && <div className="card"><span className="status s_rood">{error}</span></div>}
      {!loading && !error && gefilterd.length === 0 && (
        <div className="card"><p className="muted">Geen voorstellen gevonden.</p></div>
      )}

      {!loading && !error && gefilterd.length > 0 && (
        <div className="card doc_students_card">
          <table className="doc_students_tbl">
            <thead>
              <tr>
                <th>Student</th>
                <th>Bedrijf</th>
                <th>Stagefunctie</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {gefilterd.map((v) => {
                const initialen = (v.student_naam || "?").split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2);
                return (
                  <tr key={v.versie_id}>
                    <td>
                      <div className="doc_student_cell">
                        <div className="doc_avatar">{initialen}</div>
                        <div className="doc_student_info">
                          <div className="doc_naam">{v.student_naam || "-"}</div>
                          {v.studentennummer && <div className="doc_bedrijf">{v.studentennummer}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="doc_sub">{v.bedrijf_naam || "-"}</td>
                    <td className="doc_sub">{v.stagefunctie || "-"}</td>
                    <td>
                      <span className={"status " + getStatusClass(v.voorstel_status)}>
                        {getStatusLabel(v.voorstel_status)}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn sm" onClick={() => openDetail(v)}><IconEye size={14} stroke={1.8} /> Bekijken</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detail && h && (
        <div className="modal_overlay" onClick={() => setDetail(null)}>
          <div className="modal_box" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal_header">
              <span className="modal_title">Voorsteldetail</span>
              <button className="icon_btn" onClick={() => setDetail(null)}><IconX size={16} stroke={1.8} /></button>
            </div>
            <div className="modal_body" style={{ overflowY: "auto", maxHeight: "75vh" }}>
              <div className="kv"><span className="k">Student</span><span className="v">{h.student_naam}</span></div>
              <div className="kv"><span className="k">Bedrijf</span><span className="v">{h.bedrijf_naam || "-"}{h.bedrijfsafdeling ? ` · ${h.bedrijfsafdeling}` : ""}</span></div>
              <div className="kv"><span className="k">Mentor</span><span className="v">{h.mentor_naam || "-"}{h.mentor_functie ? ` (${h.mentor_functie})` : ""}</span></div>
              <div className="kv"><span className="k">Stagefunctie</span><span className="v">{h.stagefunctie || "-"}</span></div>
              <div className="kv"><span className="k">Periode</span><span className="v">{formatDate(h.startdatum)} – {formatDate(h.einddatum)} ({h.aantal_weken || "?"} weken)</span></div>
              <div className="kv"><span className="k">Status</span><span className={"status " + getStatusClass(h.voorstel_status)}>{getStatusLabel(h.voorstel_status)}</span></div>

              {h.opdrachtomschrijving && (
                <div style={{ marginTop: 12 }}>
                  <div className="form_label">Opdrachtomschrijving</div>
                  <p style={{ fontSize: 13, color: "var(--sub)", marginTop: 4, lineHeight: 1.6 }}>{h.opdrachtomschrijving}</p>
                </div>
              )}

              {/* Commissiefeedback / beslissingshistoriek */}
              <div style={{ marginTop: 14 }}>
                <div className="form_label">Commissiehistoriek</div>
                {detailLoading && <p className="muted" style={{ fontSize: 12.5 }}>Laden…</p>}
                {!detailLoading && (!detail.beslissingen || detail.beslissingen.length === 0) && (
                  <p className="muted" style={{ fontSize: 12.5 }}>Nog geen beslissingen geregistreerd.</p>
                )}
                {(detail.beslissingen || []).map((b) => (
                  <div key={b.id} className="kv" style={{ alignItems: "flex-start" }}>
                    <span className="k">{getStatusLabel(b.beslissing)}</span>
                    <span className="v" style={{ fontSize: 12.5 }}>
                      {formatDate(b.beslist_op)}{b.beslist_door ? ` · ${b.beslist_door}` : ""}
                      {b.feedback ? <><br /><em>{b.feedback}</em></> : null}
                      {b.motivering ? <><br /><em>{b.motivering}</em></> : null}
                    </span>
                  </div>
                ))}
              </div>

              {/* Versiehistoriek */}
              {detail.versies && detail.versies.length > 1 && (
                <div style={{ marginTop: 12 }}>
                  <div className="form_label">Versies</div>
                  {detail.versies.map((ver) => (
                    <div key={ver.id || ver.versie_id} className="kv">
                      <span className="k">Versie {ver.versie_nummer}</span>
                      <span className="v" style={{ fontSize: 12.5 }}>{formatDate(ver.ingediend_op)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
