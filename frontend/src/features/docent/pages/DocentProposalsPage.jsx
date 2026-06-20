import { useEffect, useState } from "react";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import "../docent.css";

function getStatusClass(status) {
  if (status === "goedgekeurd" || status === "goedgekeurd_met_uitzondering") return "s-ok";
  if (status === "ingediend" || status === "heringediend") return "s-info";
  if (status === "aanpassingen_gevraagd") return "s-amber";
  if (status === "afgekeurd") return "s-rood";
  return "s-grijs";
}

function getStatusLabel(status) {
  if (status === "goedgekeurd") return "Goedgekeurd";
  if (status === "goedgekeurd_met_uitzondering") return "Goedgekeurd (uitzondering)";
  if (status === "ingediend") return "Ingediend";
  if (status === "heringediend") return "Heringediend";
  if (status === "aanpassingen_gevraagd") return "Aanpassingen gevraagd";
  if (status === "afgekeurd") return "Afgekeurd";
  return status || "-";
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
  const [detail, setDetail] = useState(null);        // { huidige, versies, beslissingen }
  const [detailLoading, setDetailLoading] = useState(false);

  async function loadVoorstellen() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/docent/proposals", {
      });
      setVoorstellen(res.data.data || []);
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

  return (
    <div className="doc">
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1>Stagevoorstellen</h1>
          <p>Voorstellen van jouw studenten — alleen-lezen (de stagecommissie beslist).</p>
        </div>
        <button className="btn sm" onClick={loadVoorstellen}>Vernieuwen</button>
      </div>

      {loading && <div className="card"><p className="muted">Voorstellen laden...</p></div>}
      {error && <div className="card"><span className="status s-rood">{error}</span></div>}
      {!loading && !error && voorstellen.length === 0 && (
        <div className="card"><p className="muted">Geen voorstellen gevonden.</p></div>
      )}

      {!loading && !error && voorstellen.length > 0 && (
        <div className="card">
          <div className="card-title">Voorstellen ({voorstellen.length})</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Student</th>
                <th>Bedrijf</th>
                <th>Stagefunctie</th>
                <th>Status</th>
                <th className="right">Detail</th>
              </tr>
            </thead>
            <tbody>
              {voorstellen.map((v) => (
                <tr key={v.versie_id}>
                  <td>
                    <strong>{v.student_naam || "-"}</strong>
                    <br />
                    <span className="muted">{v.studentennummer || ""}</span>
                  </td>
                  <td>{v.bedrijf_naam || "-"}</td>
                  <td>{v.stagefunctie || "-"}</td>
                  <td>
                    <span className={"status " + getStatusClass(v.voorstel_status)}>
                      {getStatusLabel(v.voorstel_status)}
                    </span>
                  </td>
                  <td className="right">
                    <button className="btn sm" onClick={() => openDetail(v)}>Bekijken</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && h && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span className="mh-t">Voorsteldetail (read-only)</span>
              <button className="btn sm mh-x" onClick={() => setDetail(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
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
    </div>
  );
}
