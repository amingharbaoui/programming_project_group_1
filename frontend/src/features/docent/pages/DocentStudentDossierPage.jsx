import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";

function formatDate(val) {
  if (!val) return "-";
  return new Date(val).toLocaleDateString("nl-BE");
}

function getStatusClass(status) {
  if (!status) return "s_grijs";
  if (status === "goedgekeurd" || status === "actief" || status === "getekend_door_student" || status === "volledig_ondertekend" || status === "geregistreerd" || status === "goedgekeurd_door_docent" || status === "stage_loopt" || status === "afgerond") return "s_ok";
  if (status === "ingediend" || status === "in_behandeling" || status === "afgecheckt_door_mentor") return "s_info";
  if (status === "afgekeurd" || (status && status.includes("teruggestuurd"))) return "s_rood";
  return "s_amber";
}

export default function DocentStudentDossierPage() {
  const { dossierId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDossier() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/docent/students/" + dossierId + "/dossier", {
        headers: { "x-user-id": String(user.id) },
      });
      setData(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Dossier ophalen mislukt");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDossier();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossierId]);

  const d = data?.dossier || null;
  const overeenkomst = data?.stageovereenkomst || null;
  const documenten = data?.documenten || [];
  const logboeken = data?.logboeken || [];
  const evaluaties = data?.evaluaties || [];

  return (
    <div className="page_inner">
      <div className="page_header">
        <div>
          <button className="btn sm" style={{ marginBottom: "8px" }} onClick={() => navigate("/docent/students")}>
            <i className="ti ti-arrow-left" /> Terug
          </button>
          <h1>Studentdossier</h1>
          <p>Volledig overzicht van stage, contract, documenten, logboeken en evaluaties (read-only).</p>
        </div>
        <button className="btn sm" onClick={loadDossier}>Vernieuwen</button>
      </div>

      {loading && <div className="card"><p className="muted">Dossier laden...</p></div>}
      {error && <div className="card"><span className="status s_rood">{error}</span></div>}

      {!loading && !error && d && (
        <>
          {/* Snelle links */}
          <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn sm" onClick={() => navigate(`/docent/logbooks?student=${d.student_id}`)}><i className="ti ti-notebook" /> Logboek</button>
            <button className="btn sm" onClick={() => navigate(`/docent/evaluation?student=${d.student_id}`)}><i className="ti ti-clipboard-check" /> Evaluatie</button>
            <button className="btn sm" onClick={() => navigate("/docent/planning")}><i className="ti ti-calendar" /> Planning</button>
          </div>

          {/* Student */}
          <div className="card">
            <div className="card_title">Student</div>
            <div className="kv"><span className="k">Naam</span><span className="v">{d.student_naam || "-"}</span></div>
            <div className="kv"><span className="k">Studentnummer</span><span className="v">{d.studentennummer || "-"}</span></div>
            <div className="kv"><span className="k">Opleiding</span><span className="v">{d.opleiding || "-"}</span></div>
            <div className="kv"><span className="k">Academiejaar</span><span className="v">{d.academiejaar || "-"}</span></div>
            <div className="kv"><span className="k">Dossierstatus</span><span className={"status " + getStatusClass(d.status)}>{d.status || "-"}</span></div>
          </div>

          {/* Bedrijf + Mentor */}
          <div className="card">
            <div className="card_title">Bedrijf &amp; Mentor</div>
            <div className="kv"><span className="k">Bedrijf</span><span className="v">{d.bedrijf_naam || "-"}</span></div>
            <div className="kv"><span className="k">Adres</span><span className="v">{d.bedrijf_adres || "-"}</span></div>
            <div className="kv"><span className="k">Mentor</span><span className="v">{d.mentor_naam || "-"}</span></div>
            <div className="kv"><span className="k">Periode</span><span className="v">{formatDate(d.startdatum)} – {formatDate(d.einddatum)}</span></div>
          </div>

          {/* Contract */}
          <div className="card">
            <div className="card_title">Stageovereenkomst</div>
            <div className="kv"><span className="k">Status</span><span className={"status " + getStatusClass(overeenkomst?.status)}>{overeenkomst?.status || "Niet beschikbaar"}</span></div>
            <div className="kv"><span className="k">Student getekend</span><span className="v">{formatDate(overeenkomst?.student_getekend_op)}</span></div>
            <div className="kv"><span className="k">Bedrijf getekend</span><span className="v">{formatDate(overeenkomst?.bedrijf_getekend_op)}</span></div>
          </div>

          {/* Documenten */}
          <div className="card">
            <div className="card_title">Documenten</div>
            {documenten.length === 0 ? (
              <p className="muted">Geen documenten gevonden.</p>
            ) : (
              <table className="tbl">
                <thead><tr><th>Document</th><th>Versie</th><th>Status</th></tr></thead>
                <tbody>
                  {documenten.map((doc) => (
                    <tr key={doc.id}>
                      <td>{doc.documenttype || doc.bestand_naam || "-"}</td>
                      <td>{doc.versie_nummer || 1}</td>
                      <td><span className={"status " + getStatusClass(doc.status)}>{doc.status || "-"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Logboeken */}
          <div className="card">
            <div className="card_title">Logboeken</div>
            {logboeken.length === 0 ? (
              <p className="muted">Geen logboeken gevonden.</p>
            ) : (
              <table className="tbl">
                <thead><tr><th>Week</th><th>Periode</th><th>Uren</th><th>Status</th></tr></thead>
                <tbody>
                  {logboeken.map((w) => (
                    <tr key={w.id}>
                      <td>Week {w.week_nummer}</td>
                      <td>{formatDate(w.week_start)} - {formatDate(w.week_einde)}</td>
                      <td>{w.totaal_uren || 0}</td>
                      <td><span className={"status " + getStatusClass(w.status)}>{w.status || "-"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Evaluaties */}
          <div className="card">
            <div className="card_title">Evaluaties</div>
            {evaluaties.length === 0 ? (
              <p className="muted">Geen evaluaties gevonden.</p>
            ) : (
              <table className="tbl">
                <thead><tr><th>Type</th><th>Status</th><th>Datum</th></tr></thead>
                <tbody>
                  {evaluaties.map((e, i) => (
                    <tr key={i}>
                      <td>{e.type || "-"}</td>
                      <td><span className={"status " + getStatusClass(e.status)}>{e.status || "-"}</span></td>
                      <td>{formatDate(e.aangemaakt_op)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
