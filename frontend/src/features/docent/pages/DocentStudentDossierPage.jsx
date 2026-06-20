import { Fragment, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import "../docent.css";

function formatDate(val) {
  if (!val) return "-";
  return new Date(val).toLocaleDateString("nl-BE");
}

function getStatusClass(status) {
  if (!status) return "s-grijs";
  if (status === "goedgekeurd" || status === "actief" || status === "getekend_door_student" || status === "volledig_ondertekend" || status === "geregistreerd" || status === "goedgekeurd_door_docent" || status === "stage_loopt" || status === "afgerond") return "s-ok";
  if (status === "ingediend" || status === "in_behandeling" || status === "afgecheckt_door_mentor") return "s-info";
  if (status === "afgekeurd" || (status && status.includes("teruggestuurd"))) return "s-rood";
  return "s-amber";
}

// Stepper: Voorstel en Beoordeling zijn altijd al voorbij zodra er een dossier bestaat
// (een dossier wordt pas aangemaakt na goedkeuring van het voorstel).
function getStappen(d, overeenkomst, evaluaties) {
  const stageAfgerond = ["afgerond", "voltooid", "resultaat_vrijgegeven"].includes(d?.status);
  const contractKlaar = overeenkomst?.status === "geregistreerd";
  const finaal = (evaluaties || []).find((e) => e.type === "finaal");
  const evalVrijgegeven = finaal?.status === "vrijgegeven";
  const evalLoopt = (evaluaties || []).some((e) => e.status && e.status !== "niet_open");

  return [
    { label: "Voorstel", sub: "Ingediend", state: "done" },
    { label: "Beoordeling", sub: "Goedgekeurd", state: "done" },
    {
      label: "Contract",
      sub: contractKlaar ? "Geregistreerd" : overeenkomst ? "Wacht op registratie" : "Nog niet opgemaakt",
      state: contractKlaar ? "done" : "actief",
    },
    {
      label: "Stage",
      sub: stageAfgerond ? "Afgerond" : contractKlaar ? "Loopt" : "Nog niet gestart",
      state: stageAfgerond ? "done" : contractKlaar ? "actief" : "todo",
    },
    {
      label: "Evaluatie",
      sub: evalVrijgegeven ? "Vrijgegeven" : evalLoopt ? "Loopt" : "—",
      state: evalVrijgegeven ? "done" : evalLoopt ? "actief" : "todo",
    },
  ];
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
    <div className="doc">
    <div className="page-inner">
      <div className="page-header">
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
      {error && <div className="card"><span className="status s-rood">{error}</span></div>}

      {!loading && !error && d && (
        <>
          {/* Stepper */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="ev-track">
              {getStappen(d, overeenkomst, evaluaties).map((s, i, arr) => (
                <Fragment key={s.label}>
                  <div className={`ev-stap${s.state === "actief" ? " actief" : ""}${s.state === "done" ? " done" : ""}`}>
                    <div className="ev-circle">{s.state === "done" ? <i className="ti ti-check" /> : i + 1}</div>
                    <div className="ev-label">{s.label}</div>
                    <div className="ev-sub">{s.sub}</div>
                  </div>
                  {i < arr.length - 1 && <div className="ev-lijn" />}
                </Fragment>
              ))}
            </div>
          </div>

          {/* Snelle links */}
          <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn sm" onClick={() => navigate(`/docent/logbooks?student=${d.student_id}`)}><i className="ti ti-notebook" /> Logboek</button>
            <button className="btn sm" onClick={() => navigate(`/docent/evaluation?student=${d.student_id}`)}><i className="ti ti-clipboard-check" /> Evaluatie</button>
            <button className="btn sm" onClick={() => navigate("/docent/planning")}><i className="ti ti-calendar" /> Planning</button>
          </div>

          {/* Student */}
          <div className="card">
            <div className="card-title">Student</div>
            <div className="kv"><span className="k">Naam</span><span className="v">{d.student_naam || "-"}</span></div>
            <div className="kv"><span className="k">Studentnummer</span><span className="v">{d.studentennummer || "-"}</span></div>
            <div className="kv"><span className="k">Opleiding</span><span className="v">{d.opleiding || "-"}</span></div>
            <div className="kv"><span className="k">Academiejaar</span><span className="v">{d.academiejaar || "-"}</span></div>
            <div className="kv"><span className="k">Dossierstatus</span><span className={"status " + getStatusClass(d.status)}>{d.status || "-"}</span></div>
          </div>

          {/* Bedrijf + Mentor */}
          <div className="card">
            <div className="card-title">Bedrijf &amp; Mentor</div>
            <div className="kv"><span className="k">Bedrijf</span><span className="v">{d.bedrijf_naam || "-"}</span></div>
            <div className="kv"><span className="k">Adres</span><span className="v">{d.bedrijf_adres || "-"}</span></div>
            <div className="kv"><span className="k">Mentor</span><span className="v">{d.mentor_naam || "-"}</span></div>
            <div className="kv"><span className="k">Periode</span><span className="v">{formatDate(d.startdatum)} – {formatDate(d.einddatum)}</span></div>
          </div>

          {/* Contract */}
          <div className="card">
            <div className="card-title">Stageovereenkomst</div>
            <div className="kv"><span className="k">Status</span><span className={"status " + getStatusClass(overeenkomst?.status)}>{overeenkomst?.status || "Niet beschikbaar"}</span></div>
            <div className="kv"><span className="k">Student getekend</span><span className="v">{formatDate(overeenkomst?.student_getekend_op)}</span></div>
            <div className="kv"><span className="k">Bedrijf getekend</span><span className="v">{formatDate(overeenkomst?.bedrijf_getekend_op)}</span></div>
          </div>

          {/* Documenten */}
          <div className="card">
            <div className="card-title">Documenten</div>
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
            <div className="card-title">Logboeken</div>
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
            <div className="card-title">Evaluaties</div>
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
    </div>
  );
}
