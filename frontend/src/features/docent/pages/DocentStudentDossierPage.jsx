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
  if (status === "goedgekeurd" || status === "actief" || status === "getekend" || status === "goedgekeurd_door_docent" || status === "stage_loopt") return "s_ok";
  if (status === "ingediend" || status === "in_behandeling" || status === "afgecheckt_door_mentor") return "s_info";
  if (status === "afgekeurd" || status?.includes("teruggestuurd")) return "s_rood";
  if (status === "in_aanvraag" || status === "aangevraagd") return "s_amber";
  return "s_grijs";
}

export default function DocentStudentDossierPage() {
  const { dossierId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [dossier, setDossier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDossier() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/docent/students/" + dossierId + "/dossier", {
        headers: { "x-user-id": String(user.id) },
      });
      setDossier(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Dossier ophalen mislukt");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDossier();
  }, [dossierId]);

  return (
    <div className="page_inner">
      <div className="page_header">
        <div>
          <button className="btn sm" style={{ marginBottom: "8px" }} onClick={() => navigate("/docent/students")}>
            <i className="ti ti-arrow-left" /> Terug
          </button>
          <h1>Studentdossier</h1>
          <p>Volledig overzicht van stage, contract, logboeken en evaluaties.</p>
        </div>
        <button className="btn sm" onClick={loadDossier}>Vernieuwen</button>
      </div>

      {loading && (
        <div className="card"><p className="muted">Dossier laden...</p></div>
      )}

      {error && (
        <div className="card"><span className="status s_rood">{error}</span></div>
      )}

      {!loading && !error && dossier && (
        <>
          {/* Student + Bedrijf */}
          <div className="card">
            <div className="card_title">Student</div>
            <div className="kv">
              <span className="k">Naam</span>
              <span className="v">{dossier.student_voornaam} {dossier.student_achternaam}</span>
            </div>
            <div className="kv">
              <span className="k">Studentnummer</span>
              <span className="v">{dossier.studentennummer || "-"}</span>
            </div>
            <div className="kv">
              <span className="k">Opleiding</span>
              <span className="v">{dossier.opleiding || "-"}</span>
            </div>
            <div className="kv">
              <span className="k">Academiejaar</span>
              <span className="v">{dossier.academiejaar || "-"}</span>
            </div>
            <div className="kv">
              <span className="k">Dossierstatus</span>
              <span className={"status " + getStatusClass(dossier.dossier_status)}>
                {dossier.dossier_status || "-"}
              </span>
            </div>
          </div>

          {/* Bedrijf + Mentor */}
          <div className="card">
            <div className="card_title">Bedrijf &amp; Mentor</div>
            <div className="kv">
              <span className="k">Bedrijf</span>
              <span className="v">{dossier.bedrijf_naam || "-"}</span>
            </div>
            <div className="kv">
              <span className="k">Adres</span>
              <span className="v">{dossier.bedrijf_adres || "-"}</span>
            </div>
            <div className="kv">
              <span className="k">Mentor</span>
              <span className="v">
                {dossier.mentor_voornaam ? dossier.mentor_voornaam + " " + dossier.mentor_achternaam : "-"}
              </span>
            </div>
            <div className="kv">
              <span className="k">Startdatum</span>
              <span className="v">{formatDate(dossier.startdatum)}</span>
            </div>
            <div className="kv">
              <span className="k">Einddatum</span>
              <span className="v">{formatDate(dossier.einddatum)}</span>
            </div>
          </div>

          {/* Contract */}
          <div className="card">
            <div className="card_title">Contract</div>
            <div className="kv">
              <span className="k">Status</span>
              <span className={"status " + getStatusClass(dossier.contract_status)}>
                {dossier.contract_status || "Niet beschikbaar"}
              </span>
            </div>
            {dossier.contract_getekend_op && (
              <div className="kv">
                <span className="k">Getekend op</span>
                <span className="v">{formatDate(dossier.contract_getekend_op)}</span>
              </div>
            )}
          </div>

          {/* Logboeken */}
          <div className="card">
            <div className="card_title">Logboeken</div>
            {(!dossier.logboeken || dossier.logboeken.length === 0) ? (
              <p className="muted">Geen logboeken gevonden.</p>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Periode</th>
                    <th>Uren</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dossier.logboeken.map((w) => (
                    <tr key={w.id}>
                      <td>Week {w.week_nummer}</td>
                      <td>{formatDate(w.week_start)} - {formatDate(w.week_einde)}</td>
                      <td>{w.totaal_uren || 0}</td>
                      <td>
                        <span className={"status " + getStatusClass(w.status)}>
                          {w.status || "-"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Evaluaties */}
          <div className="card">
            <div className="card_title">Evaluaties</div>
            {(!dossier.evaluaties || dossier.evaluaties.length === 0) ? (
              <p className="muted">Geen evaluaties gevonden.</p>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Datum</th>
                  </tr>
                </thead>
                <tbody>
                  {dossier.evaluaties.map((e, i) => (
                    <tr key={i}>
                      <td>{e.type || "-"}</td>
                      <td>
                        <span className={"status " + getStatusClass(e.status)}>
                          {e.status || "-"}
                        </span>
                      </td>
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
