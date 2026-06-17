import { useEffect, useState } from "react";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";

function getStatusClass(status) {
  if (status === "goedgekeurd") return "s_ok";
  if (status === "ingediend" || status === "in_behandeling") return "s_info";
  if (status === "afgekeurd") return "s_rood";
  return "s_grijs";
}

function getStatusLabel(status) {
  if (status === "goedgekeurd") return "Goedgekeurd";
  if (status === "ingediend") return "Ingediend";
  if (status === "in_behandeling") return "In behandeling";
  if (status === "afgekeurd") return "Afgekeurd";
  return status || "-";
}

export default function DocentProposalsPage() {
  const { user } = useAuth();
  const [voorstellen, setVoorstellen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [geselecteerd, setGeselecteerd] = useState(null);

  async function loadVoorstellen() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/docent/proposals", {
        headers: { "x-user-id": String(user.id) },
      });
      setVoorstellen(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Voorstellen ophalen mislukt");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVoorstellen();
  }, []);

  return (
    <div className="page_inner">
      <div className="page_header">
        <div>
          <h1>Stagevoorstellen</h1>
          <p>Goedgekeurde voorstellen van jouw studenten (read-only).</p>
        </div>
        <button className="btn sm" onClick={loadVoorstellen}>Vernieuwen</button>
      </div>

      {loading && <div className="card"><p className="muted">Voorstellen laden...</p></div>}
      {error && <div className="card"><span className="status s_rood">{error}</span></div>}
      {!loading && !error && voorstellen.length === 0 && (
        <div className="empty_state">Geen goedgekeurde voorstellen gevonden.</div>
      )}

      {!loading && !error && voorstellen.length > 0 && (
        <div className="card">
          <div className="card_title">Voorstellen ({voorstellen.length})</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Student</th>
                <th>Bedrijf</th>
                <th>Opleiding</th>
                <th>Status</th>
                <th className="right">Detail</th>
              </tr>
            </thead>
            <tbody>
              {voorstellen.map((v) => (
                <tr key={v.id}>
                  <td>
                    <strong>{v.student_naam || "-"}</strong>
                    <br />
                    <span className="muted">{v.studentennummer || ""}</span>
                  </td>
                  <td>{v.bedrijf_naam || "-"}</td>
                  <td>{v.opleiding || "-"}</td>
                  <td>
                    <span className={"status " + getStatusClass(v.status)}>
                      {getStatusLabel(v.status)}
                    </span>
                  </td>
                  <td className="right">
                    <button className="btn sm" onClick={() => setGeselecteerd(v)}>
                      Bekijken
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {geselecteerd && (
        <div className="popup-overlay" onClick={() => setGeselecteerd(null)}>
          <div className="popup" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <strong>Voorsteldetail</strong>
              <button className="btn sm" onClick={() => setGeselecteerd(null)}>
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="popup-body">
              <div className="kv">
                <span className="k">Student</span>
                <span className="v">{geselecteerd.student_naam}</span>
              </div>
              <div className="kv">
                <span className="k">Bedrijf</span>
                <span className="v">{geselecteerd.bedrijf_naam}</span>
              </div>
              <div className="kv">
                <span className="k">Opleiding</span>
                <span className="v">{geselecteerd.opleiding || "-"}</span>
              </div>
              <div className="kv">
                <span className="k">Academiejaar</span>
                <span className="v">{geselecteerd.academiejaar || "-"}</span>
              </div>
              <div className="kv">
                <span className="k">Status</span>
                <span className={"status " + getStatusClass(geselecteerd.status)}>
                  {getStatusLabel(geselecteerd.status)}
                </span>
              </div>
              {geselecteerd.goedgekeurd_op && (
                <div className="kv">
                  <span className="k">Goedgekeurd op</span>
                  <span className="v">
                    {new Date(geselecteerd.goedgekeurd_op).toLocaleDateString("nl-BE")}
                  </span>
                </div>
              )}
              {geselecteerd.beschrijving && (
                <div style={{ marginTop: "12px" }}>
                  <div className="form_label">Beschrijving</div>
                  <p style={{ fontSize: "13px", color: "var(--sub)", marginTop: "4px", lineHeight: 1.6 }}>
                    {geselecteerd.beschrijving}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
