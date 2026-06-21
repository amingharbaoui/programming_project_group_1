import { Fragment, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import "./DocentStudentDossierPage.css";
import { IconArrowLeft, IconCheck, IconRefresh } from "@tabler/icons-react";
import { cacheGet, cacheSet, cacheDelete } from "../docentCache";
import {
  canMarkMomentDone,
  canPlanPresentation,
  canPlanVisit,
  dossierFaseLabel,
  isDossierAfgerond,
  planningStatusClass,
  planningStatusLabel,
} from "../../../utils/stageFlow";

function formatDate(val) {
  if (!val) return "-";
  return new Date(val).toLocaleDateString("nl-BE");
}

const STATUS_LABELS = {
  // Stagedossier
  wacht_op_student:               "Wacht op student",
  wacht_op_bedrijf:               "Wacht op bedrijf",
  in_controle_bij_administratie:  "In controle bij administratie",
  document_afgekeurd:             "Document afgekeurd",
  geregistreerd:                  "Geregistreerd",
  stage_loopt:                    "Stage loopt",
  resultaat_vrijgegeven:          "Resultaat vrijgegeven",
  afgerond:                       "Afgerond",
  // Stageovereenkomst
  klaar_voor_student:             "Klaar voor student",
  getekend_door_student:          "Getekend door student",
  volledig_ondertekend:           "Volledig ondertekend",
  // Documenten
  ontbreekt:                      "Ontbreekt",
  ingediend:                      "Ingediend",
  in_controle:                    "In controle",
  goedgekeurd:                    "Goedgekeurd",
  // Evaluaties
  niet_open:                      "Nog niet beschikbaar",
  open:                           "Geopend",
  student_ingediend:              "Student ingediend",
  mentor_ingediend:               "Mentor ingediend",
  klaar_voor_docent:              "Klaar om in te vullen",
  klaar_voor_vrijgave:            "Klaar om vrij te geven",
  vrijgegeven:                    "Vrijgegeven",
  // Logboek weken
  niet_gestart:                   "Nog niet gestart",
  in_opbouw:                      "In opbouw",
  afgecheckt_door_mentor:         "Nagekeken door mentor",
  teruggestuurd_door_mentor:      "Teruggestuurd door mentor",
  teruggestuurd_door_docent:      "Teruggestuurd door jou",
  goedgekeurd_door_docent:        "Goedgekeurd door jou",
  afgesloten:                     "Afgesloten",
  afgekeurd:                      "Afgekeurd",
};

function statusLabel(status) {
  return STATUS_LABELS[status] || status || "-";
}

function getStatusClass(status) {
  if (!status) return "s_grijs";
  const ok = ["goedgekeurd", "volledig_ondertekend", "geregistreerd", "goedgekeurd_door_docent",
               "stage_loopt", "afgerond", "resultaat_vrijgegeven", "vrijgegeven", "afgesloten", "klaar_voor_vrijgave"];
  const info = ["ingediend", "afgecheckt_door_mentor", "getekend_door_student", "student_ingediend",
                 "mentor_ingediend", "in_opbouw"];
  const rood = ["afgekeurd", "document_afgekeurd", "ontbreekt"];
  if (ok.includes(status)) return "s_ok";
  if (info.includes(status)) return "s_info";
  if (rood.includes(status) || status.includes("teruggestuurd")) return "s_rood";
  // amber: klaar_voor_docent, wacht_op_*, in_controle*, klaar_voor_student, niet_open, open
  return "s_amber";
}

function formatDateTime(val) {
  if (!val) return "-";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.toLocaleDateString("nl-BE")} ${d.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}`;
}

function planningTypeLabel(type) {
  if (type === "bedrijfsbezoek") return "Bedrijfsbezoek";
  if (type === "eindpresentatie") return "Eindpresentatie";
  if (type === "tussentijdse_bespreking") return "Tussentijdse bespreking";
  return type || "Planning";
}

function evaluationTypeLabel(type) {
  if (type === "tussentijds") return "Tussentijds";
  if (type === "finaal") return "Finaal";
  return type || "-";
}

function findPlanning(planning, type) {
  return (planning || []).find((m) => m.type === type && m.status !== "geannuleerd");
}

function findEval(evaluaties, type) {
  return (evaluaties || []).find((e) => e.type === type);
}

function docentStudentForGate(d, planning, evaluaties) {
  return {
    dossier_status: d?.status,
    mentor_naam: d?.mentor_naam,
    mentor_id: d?.mentor_id,
    bezoek_geweest: (planning || []).filter((m) => m.type === "bedrijfsbezoek" && ["gegeven", "geweest"].includes(m.status)).length,
    tussentijds_geregistreerd: (evaluaties || []).filter((e) => e.type === "tussentijds" && ["geregistreerd", "vrijgegeven"].includes(e.status)).length,
  };
}

function buildOpenActies(d, overeenkomst, planning, logboeken, evaluaties) {
  const acties = [];
  const gateStudent = docentStudentForGate(d, planning, evaluaties);
  const bezoek = findPlanning(planning, "bedrijfsbezoek");
  const presentatie = findPlanning(planning, "eindpresentatie");
  const tussentijds = findEval(evaluaties, "tussentijds");
  const finaal = findEval(evaluaties, "finaal");
  const contractKlaar = overeenkomst?.status === "geregistreerd";
  const afgerond = isDossierAfgerond(d?.status);

  if (afgerond) {
    return [{ titel: "Dossier afgerond", tekst: "Het resultaat is vrijgegeven. Dit dossier is nu read-only.", route: null, status: "s_ok" }];
  }

  if (!contractKlaar) {
    acties.push({
      titel: "Wacht op stageovereenkomst",
      tekst: "Planning en evaluaties blijven geblokkeerd tot de stageovereenkomst geregistreerd is.",
      route: null,
      status: "s_amber",
    });
  }

  if (!d?.mentor_naam && contractKlaar) {
    acties.push({
      titel: "Mentor ontbreekt",
      tekst: "Laat administratie eerst een mentor koppelen. Zonder mentor kan geen bezoek of presentatie bevestigd worden.",
      route: null,
      status: "s_rood",
    });
  }

  const bezoekGate = canPlanVisit(gateStudent);
  if (!bezoek) {
    acties.push({
      titel: "Bedrijfsbezoek plannen",
      tekst: bezoekGate.ok ? "Plan het eerste bezoek bij het bedrijf." : bezoekGate.reason,
      route: bezoekGate.ok ? "/docent/planning" : null,
      status: bezoekGate.ok ? "s_rood" : "s_grijs",
    });
  } else if (bezoek.status === "alternatief_gevraagd") {
    acties.push({
      titel: "Mentorvoorstel bekijken",
      tekst: "De mentor heeft een ander moment voorgesteld. Pas de planning aan of bevestig het nieuwe moment.",
      route: "/docent/planning",
      status: "s_amber",
    });
  } else if (["voorgesteld", "gepland"].includes(bezoek.status)) {
    acties.push({
      titel: "Wacht op mentor",
      tekst: "De student ziet dit bezoek pas nadat de mentor het bevestigt.",
      route: "/docent/planning",
      status: "s_amber",
    });
  } else if (["bevestigd", "gepland"].includes(bezoek.status)) {
    const markeerGate = canMarkMomentDone(bezoek);
    acties.push({
      titel: "Bedrijfsbezoek afwerken",
      tekst: markeerGate.ok ? "Markeer het bezoek als geweest zodra het effectief heeft plaatsgevonden." : markeerGate.reason,
      route: "/docent/planning",
      status: markeerGate.ok ? "s_rood" : "s_amber",
    });
  }

  const weekTeReview = (logboeken || []).find((w) => w.status === "afgecheckt_door_mentor");
  if (weekTeReview) {
    acties.push({
      titel: `Logboek week ${weekTeReview.week_nummer} nalezen`,
      tekst: "Deze week is door de mentor afgecheckt en wacht op docentcontrole.",
      route: "/docent/logbooks",
      status: "s_rood",
    });
  }

  if (tussentijds?.status === "klaar_voor_docent") {
    acties.push({
      titel: "Tussentijdse evaluatie registreren",
      tekst: "Student en mentor hebben input gegeven. Registreer nu de tussentijdse feedback.",
      route: "/docent/evaluations",
      status: "s_rood",
    });
  }

  const presentatieGate = canPlanPresentation(gateStudent);
  if (!presentatie && (bezoek?.status === "gegeven" || bezoek?.status === "geweest" || presentatieGate.ok)) {
    acties.push({
      titel: "Eindpresentatie plannen",
      tekst: presentatieGate.ok ? "Plan de eindpresentatie met mentor en student." : presentatieGate.reason,
      route: presentatieGate.ok ? "/docent/planning" : null,
      status: presentatieGate.ok ? "s_rood" : "s_grijs",
    });
  } else if (presentatie?.status === "alternatief_gevraagd") {
    acties.push({
      titel: "Alternatief voor eindpresentatie",
      tekst: "De mentor heeft een ander presentatiemoment voorgesteld.",
      route: "/docent/planning",
      status: "s_amber",
    });
  } else if (["voorgesteld", "gepland"].includes(presentatie?.status)) {
    acties.push({
      titel: "Wacht op bevestiging presentatie",
      tekst: "De student krijgt de presentatie pas te zien nadat de mentor bevestigt.",
      route: "/docent/planning",
      status: "s_amber",
    });
  } else if (presentatie?.status === "bevestigd") {
    const markeerGate = canMarkMomentDone(presentatie);
    acties.push({
      titel: "Eindpresentatie afwerken",
      tekst: markeerGate.ok ? "Markeer de presentatie als gegeven om de finale evaluatie te openen." : markeerGate.reason,
      route: "/docent/planning",
      status: markeerGate.ok ? "s_rood" : "s_amber",
    });
  }

  if (finaal?.status === "klaar_voor_docent") {
    acties.push({
      titel: "Finale beoordeling registreren",
      tekst: "De finale input is klaar voor de docentbeoordeling en rubriek.",
      route: "/docent/evaluations",
      status: "s_rood",
    });
  }
  if (finaal?.status === "klaar_voor_vrijgave") {
    acties.push({
      titel: "Eindresultaat vrijgeven",
      tekst: "Alle scores zijn berekend. Geef het resultaat vrij voor de student.",
      route: "/docent/evaluations",
      status: "s_rood",
    });
  }

  if (acties.length === 0) {
    acties.push({
      titel: "Geen open docentactie",
      tekst: "Er is momenteel geen actie nodig voor dit dossier.",
      route: null,
      status: "s_ok",
    });
  }
  return acties;
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
  const planning = data?.planning || [];
  const logboeken = data?.logboeken || [];
  const evaluaties = data?.evaluaties || [];
  const openActies = d ? buildOpenActies(d, overeenkomst, planning, logboeken, evaluaties) : [];

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

          {/* Open acties */}
          <div className="card">
            <div className="card_title">Open acties</div>
            <div className="dd_actions">
              {openActies.map((actie, i) => (
                <div className="dd_action" key={`${actie.titel}-${i}`}>
                  <span className={`status ${actie.status}`}>{actie.titel}</span>
                  <p>{actie.tekst}</p>
                  {actie.route && (
                    <button className="btn sm" onClick={() => navigate(actie.route)}>
                      Openen
                    </button>
                  )}
                </div>
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
            <div className="kv"><span className="k">Dossierstatus</span><span className={"status " + getStatusClass(d.status)}>{statusLabel(d.status)}</span></div>
            <div className="kv"><span className="k">Flowfase</span><span className="v">{dossierFaseLabel(d.status)}</span></div>
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
            <div className="kv"><span className="k">Status</span><span className={"status " + getStatusClass(overeenkomst?.status)}>{overeenkomst ? statusLabel(overeenkomst.status) : "Niet beschikbaar"}</span></div>
            <div className="kv"><span className="k">Student getekend</span><span className="v">{formatDate(overeenkomst?.student_getekend_op)}</span></div>
            <div className="kv"><span className="k">Bedrijf getekend</span><span className="v">{formatDate(overeenkomst?.bedrijf_getekend_op)}</span></div>
          </div>

          {/* Planning */}
          <div className="card">
            <div className="card_title">Planning &amp; afspraken</div>
            {planning.length === 0 ? (
              <p className="muted">Nog geen bedrijfsbezoek of eindpresentatie gepland.</p>
            ) : (
              <table className="tbl">
                <thead><tr><th>Type</th><th>Wanneer</th><th>Locatie</th><th>Status</th></tr></thead>
                <tbody>
                  {planning.map((m) => (
                    <tr key={m.id}>
                      <td>{planningTypeLabel(m.type)}</td>
                      <td>{formatDateTime(m.gepland_op)}</td>
                      <td>{m.locatie || "-"}</td>
                      <td><span className={"status " + planningStatusClass(m.status)}>{planningStatusLabel(m)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
                      <td><span className={"status " + getStatusClass(doc.status)}>{statusLabel(doc.status)}</span></td>
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
                      <td><span className={"status " + getStatusClass(w.status)}>{statusLabel(w.status)}</span></td>
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
                      <td>{evaluationTypeLabel(e.type)}</td>
                      <td><span className={"status " + getStatusClass(e.status)}>{statusLabel(e.status)}</span></td>
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
