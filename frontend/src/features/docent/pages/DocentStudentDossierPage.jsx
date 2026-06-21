import { Fragment, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import "./DocentStudentDossierPage.css";
import { IconArrowLeft, IconCheck, IconRefresh } from "@tabler/icons-react";
import { cacheGet, cacheSet, cacheDelete } from "../docentCache";

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

// Stepper: Voorstel en Beoordeling zijn altijd al voorbij zodra er een dossier bestaat
// (een dossier wordt pas aangemaakt na goedkeuring van het voorstel).
function getStappen(d, overeenkomst, evaluaties) {
  const stageAfgerond = ["afgerond", "voltooid", "resultaat_vrijgegeven"].includes(d?.status);
  const contractKlaar = overeenkomst?.status === "geregistreerd";
  // De stage zelf wordt afgeleid uit de échte dossierstatus, niet uit de contractstatus —
  // anders toont de stepper "nog niet gestart" terwijl het logboek/evaluatie al wél lopen
  // (kan gebeuren als de administratie het contract laat registreert).
  const stageLoopt = stageAfgerond || ["actief", "stage_loopt"].includes(d?.status);
  const finaal = (evaluaties || []).find((e) => e.type === "finaal");
  // Een evaluatie kan logisch niet "lopen" of "vrijgegeven" zijn vóór de stage zelf actief is —
  // ook als losse datavelden dat (door een fout elders) wel zouden suggereren.
  const evalVrijgegeven = stageLoopt && finaal?.status === "vrijgegeven";
  const evalLoopt = stageLoopt && (evaluaties || []).some((e) => e.status && e.status !== "niet_open");

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
      sub: stageAfgerond ? "Afgerond" : stageLoopt ? "Loopt" : "Nog niet gestart",
      state: stageAfgerond ? "done" : stageLoopt ? "actief" : "todo",
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

  async function loadDossier(force = false) {
    try {
      setError("");
      const key = `docent_dossier_${dossierId}`;
      if (!force) {
        const cached = cacheGet(key);
        if (cached) { setData(cached); setLoading(false); return; }
      }
      setLoading(true);
      const res = await api.get("/docent/students/" + dossierId + "/dossier");
      cacheSet(key, res.data.data);
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
    <div className="page-inner doc_dossier">
      <div className="page-header">
        <div>
          <button className="dd_back" onClick={() => navigate("/docent/students")}>
            <IconArrowLeft size={15} stroke={2.2} /> Terug
          </button>
          <h1>Studentdossier</h1>
          <p>Volledig overzicht van stage, contract, documenten, logboeken en evaluaties (read-only).</p>
        </div>
        <button className="btn primary" onClick={() => loadDossier(true)}><IconRefresh size={14} stroke={1.8} /> Vernieuwen</button>
      </div>

      {loading && <div className="card"><p className="muted">Dossier laden...</p></div>}
      {error && <div className="card"><span className="status s_rood">{error}</span></div>}

      {!loading && !error && d && (
        <>
          {/* Stepper */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="doc_ev_track">
              {getStappen(d, overeenkomst, evaluaties).map((s, i, arr) => (
                <Fragment key={s.label}>
                  <div className={`doc_ev_stap${s.state === "actief" ? " actief" : ""}${s.state === "done" ? " done" : ""}`}>
                    <div className="doc_ev_circle">{s.state === "done" ? <IconCheck size={17} stroke={2.2} /> : i + 1}</div>
                    <div className="doc_ev_label">{s.label}</div>
                    <div className="doc_ev_sub">{s.sub}</div>
                  </div>
                  {i < arr.length - 1 && <div className="doc_ev_lijn" />}
                </Fragment>
              ))}
            </div>
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
