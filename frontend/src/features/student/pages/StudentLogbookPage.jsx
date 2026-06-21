import { useState, useEffect } from "react";
import { apiRequest } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { cacheGet, cacheSet, cacheDelete } from "../studentCache";
import "./Logboek.css";
import Modal from "../../../components/ui/Modal";
import {
  IconCalendar,
  IconCalendarOff,
  IconSend,
  IconPlus,
  IconCircleCheck,
  IconChevronDown,
  IconChevronUp,
  IconLock,
  IconMessage,
  IconPencil,
  IconAlertCircle,
} from "@tabler/icons-react";

const DAG_NAMEN = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag"];

const DRAFT_KEY = (uid) => `logboek_draft_${uid}`;

const TERUGGESTUURD_STATUSSEN = [
  "teruggestuurd_door_mentor",
  "teruggestuurd_door_docent",
];

/* ---------- Statusbadge ---------- */
function StatusBadge({ status }) {
  const map = {
    ingediend:                 ["s_info",  "Ingediend · wacht op mentor"],
    afgecheckt_door_mentor:    ["s_ok",    "Afgetekend door mentor"],
    teruggestuurd_door_mentor: ["s_rood",  "Aanpassing nodig"],
    klaar_voor_docent:         ["s_info",  "Klaar voor docent"],
    goedgekeurd_door_docent:   ["s_ok",    "Goedgekeurd"],
    teruggestuurd_door_docent: ["s_rood",  "Teruggestuurd door docent"],
    afgesloten:                ["s_ok",    "Afgesloten"],
    in_opbouw:                 ["s_grijs", "In opbouw"],
    niet_gestart:              ["s_grijs", "Nog niet begonnen"],
    ontbreekt:                 ["s_rood",  "Ontbreekt"],
  };
  const [cls, label] = map[status] ?? ["s_grijs", status];
  return <span className={`status ${cls}`}>{label}</span>;
}

/* ---------- Ingediende week component ---------- */
function LogboekWeek({ week, onBewerken, onVernieuwen }) {
  const [open, setOpen] = useState(false);

  const aanpassingNodig =
    week.herindiening_nodig ||
    TERUGGESTUURD_STATUSSEN.includes(week.status);

  function formatDate(d) {
    if (!d) return "–";
    return new Date(d).toLocaleDateString("nl-BE");
  }

  function dagNaam(datum, index) {
    if (!datum) return DAG_NAMEN[index] ?? `Dag ${index + 1}`;
    return new Date(datum).toLocaleDateString("nl-BE", { weekday: "long" });
  }

  // Zet de week altijd open als aanpassing nodig is
  const isOpen = aanpassingNodig ? true : open;

  return (
    <div
      className="logweek"
      style={aanpassingNodig ? { borderColor: "var(--red-mid)" } : {}}
    >
      <div
        className={`logweek-header${isOpen ? " open" : ""}`}
        onClick={() => !aanpassingNodig && setOpen(!open)}
        style={aanpassingNodig ? { cursor: "default" } : {}}
      >
        <span style={{ fontSize: "13.5px", fontWeight: 600 }}>
          Week {week.week_nummer}
        </span>
        <span style={{ fontSize: "12px", color: "var(--sub)" }}>
          {formatDate(week.week_start)} – {formatDate(week.week_einde)}
        </span>
        <StatusBadge status={week.status} />
        {!aanpassingNodig && (
          <i className="ti ti-chevron-down logweek-chevron" />
        )}
      </div>

      {isOpen && (
        <div className="logweek-body open">
          {/* Aanpassing nodig blok — prominent bovenaan */}
          {aanpassingNodig && (
            <div
              className="fb-blok"
              style={{ borderLeftColor: "var(--red)", marginBottom: 12 }}
            >
              <div className="fb-wie" style={{ color: "var(--red)" }}>
                <IconAlertCircle size={13} />
                Aanpassing gevraagd
              </div>
              {week.mentor_feedback && (
                <div className="fb-wat" style={{ marginBottom: 6 }}>
                  <strong>Mentor:</strong> "{week.mentor_feedback}"
                </div>
              )}
              {week.docent_feedback && (
                <div className="fb-wat">
                  <strong>Docent:</strong> "{week.docent_feedback}"
                </div>
              )}
              <div style={{ marginTop: 10 }}>
                <button
                  className="btn primary sm"
                  onClick={() => onBewerken(week)}
                >
                  <IconPencil size={14} />
                  Week {week.week_nummer} bewerken
                </button>
              </div>
            </div>
          )}

          {/* Normale feedback (mentor/docent, geen aanpassing nodig) */}
          {!aanpassingNodig && week.mentor_feedback && (
            <div className="fb-blok" style={{ borderLeftColor: "var(--green)" }}>
              <div className="fb-wie">
                <IconCircleCheck size={13} style={{ color: "var(--green)" }} />
                Mentor · {formatDate(week.mentor_nagekeken_op)}
              </div>
              <div className="fb-wat">"{week.mentor_feedback}"</div>
            </div>
          )}
          {!aanpassingNodig && week.docent_feedback && (
            <div className="fb-blok">
              <div className="fb-wie">
                <IconMessage size={13} style={{ color: "var(--blue)" }} />
                Docent · {formatDate(week.docent_nagekeken_op)}
              </div>
              <div className="fb-wat">"{week.docent_feedback}"</div>
            </div>
          )}

          {/* Antwoordveld op feedback */}
          {!aanpassingNodig && (week.mentor_feedback || week.docent_feedback) && (
            <AntwoordBlok week={week} onAntwoordOpgeslagen={onVernieuwen} />
          )}

          {/* Dag rijen */}
          {(week.dagen || []).map((dag, i) => {
            const dagCompetenties = Array.isArray(dag.competenties)
              ? dag.competenties
              : (dag.competenties ? JSON.parse(dag.competenties) : []);
            return (
              <div className="dag-rij" key={i}>
                <div className="dag-rij-hoofd">
                  <span className="dag-naam">{dagNaam(dag.datum, i)}</span>
                  <span className="dag-samenvatting">
                    {dag.titel || dag.uitgevoerde_taken || "–"}
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--sub)", flexShrink: 0 }}>
                    {dag.aantal_uren}u
                  </span>
                </div>
                {dagCompetenties.length > 0 && (
                  <div className="dag-lo-chips">
                    {dagCompetenties.map((code) => (
                      <span key={code} className="dag-lo-badge">{code}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ fontSize: "12.5px", color: "var(--sub)", marginTop: 8 }}>
            Totaal: <strong>{Number(week.totaal_uren).toFixed(1)}u</strong>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Hulpfuncties ---------- */
function AntwoordBlok({ week, onAntwoordOpgeslagen }) {
  const [open, setOpen]       = useState(false);
  const [tekst, setTekst]     = useState(week.student_antwoord || "");
  const [bezig, setBezig]     = useState(false);
  const [opgeslagen, setOpgeslagen] = useState(false);

  async function verstuur() {
    if (!tekst.trim()) return;
    setBezig(true);
    try {
      await apiRequest("PATCH", `/logbooks/weeks/${week.id}/antwoord`, { antwoord: tekst });
      setOpgeslagen(true);
      setOpen(false);
      if (onAntwoordOpgeslagen) onAntwoordOpgeslagen();
    } catch {
      /* stil falen */
    } finally {
      setBezig(false);
    }
  }

  return (
    <div style={{ margin: "12px 0" }}>
      {week.student_antwoord && !open && (
        <div className="fb-blok" style={{ borderLeftColor: "var(--blue, #3b82f6)", marginBottom: 12 }}>
          <div className="fb-wie" style={{ color: "var(--blue, #3b82f6)" }}>
            Jouw antwoord
          </div>
          <div className="fb-wat">"{week.student_antwoord}"</div>
        </div>
      )}
      {!open && (
        <button
          className="btn sm"
          onClick={() => { setOpen(true); setOpgeslagen(false); }}
        >
          <IconMessage size={13} />
          {week.student_antwoord ? "Antwoord bewerken" : "Beantwoorden"}
        </button>
      )}
      {open && (
        <div style={{ marginTop: 6 }}>
          <textarea
            className="form_textarea"
            style={{ minHeight: 44, fontSize: 12.5 }}
            placeholder="Je antwoord…"
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            autoFocus
          />
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button className="btn primary sm" onClick={verstuur} disabled={bezig || !tekst.trim()}>
              {bezig ? "Bezig…" : "Verstuur"}
            </button>
            <button className="btn sm" onClick={() => setOpen(false)}>Annuleer</button>
          </div>
        </div>
      )}
    </div>
  );
}

const LO_COMPETENTIES = [
  { code: "LO1",  naam: "Beheersing van het planningsproces" },
  { code: "LO2",  naam: "Ontwerpen van IT-oplossingen" },
  { code: "LO3",  naam: "Implementatie van digitale producten" },
  { code: "LO4",  naam: "Integratie van technologie en infrastructuur" },
  { code: "LO5",  naam: "Onderzoekende houding" },
  { code: "LO6",  naam: "Helder en transparant communiceren" },
  { code: "LO7",  naam: "Probleemoplossend vermogen" },
  { code: "LO8",  naam: "Persoonlijke ontwikkeling" },
  { code: "LO9",  naam: "Professionele attitude" },
  { code: "LO10", naam: "Ondernemend handelen" },
  { code: "LO11", naam: "Ethisch en deontologisch handelen" },
];

function leegDag() {
  return {
    datum: "",
    titel: "",
    uitgevoerdeTaken: "",
    reflectie: "",
    problemen: "",
    aantalUren: 0,
    competenties: [],
  };
}

// Berekent maandag–vrijdag van week `weekNummer` vanuit de stage-startdatum.
// Als startDatum ontbreekt, valt het terug op de maandag van de huidige week.
function berekenWeekDatums(startDatum, weekNummer) {
  let basis;
  if (startDatum) {
    basis = new Date(startDatum);
    basis.setHours(12, 0, 0, 0);
  } else {
    // Geen startdatum: gebruik maandag van de huidige week als basis
    basis = new Date();
    basis.setHours(12, 0, 0, 0);
    const dag = basis.getDay(); // 0 = zon, 1 = ma, ...
    const naarMaandag = dag === 0 ? -6 : 1 - dag;
    basis.setDate(basis.getDate() + naarMaandag);
  }

  // Verschuif naar de juiste week
  const ma = new Date(basis);
  ma.setDate(ma.getDate() + (weekNummer - 1) * 7);

  const vr = new Date(ma);
  vr.setDate(vr.getDate() + 4);

  const dagDatums = [0, 1, 2, 3, 4].map((i) => {
    const d = new Date(ma);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  return {
    weekStart: ma.toISOString().slice(0, 10),
    weekEinde: vr.toISOString().slice(0, 10),
    dagDatums,
  };
}

function defaultLogbook(weekNummer = 1, startDatum = null) {
  const { weekStart, weekEinde, dagDatums } = berekenWeekDatums(startDatum, weekNummer);
  return {
    stagedossierId: "",
    weekNummer,
    weekStart,
    weekEinde,
    dagen: dagDatums.map((datum) => ({ ...leegDag(), datum })),
  };
}

// Zet een backend week om naar het formulierformaat
function weekNaarFormulier(week) {
  return {
    stagedossierId: week.stagedossier_id ?? 1,
    weekNummer: week.week_nummer,
    weekStart: week.week_start ? week.week_start.slice(0, 10) : "",
    weekEinde: week.week_einde ? week.week_einde.slice(0, 10) : "",
    dagen: (week.dagen || []).map((dag) => ({
      datum: dag.datum ? dag.datum.slice(0, 10) : "",
      titel: dag.titel ?? "",
      uitgevoerdeTaken: dag.uitgevoerde_taken ?? "",
      reflectie: dag.reflectie ?? "",
      problemen: dag.problemen ?? "",
      aantalUren: Number(dag.aantal_uren) || 0,
      // Dagstatus behouden, anders verliest een 'geen_stagedag' bij bewerken zijn markering
      // en wordt hij bij opnieuw indienen als gewone stagedag verstuurd.
      status: dag.status ?? "",
      competenties: Array.isArray(dag.competenties)
        ? dag.competenties
        : (dag.competenties ? JSON.parse(dag.competenties) : []),
    })),
  };
}

/* ---------- Week formulier (nieuw + bewerken) ---------- */
function WeekFormulier({ logbook, setLogbook, onSubmit, saving, isBewerken, aantalWeken, competentieLijst = LO_COMPETENTIES }) {
  // Bereken per dag of hij al ingevuld is (status="geen_stagedag" of expliciete vlag)
  const [ingediendeDagen, setIngediendeDagen] = useState(
    logbook.dagen.map((d) => !!(d._bevestigd || d.status === "geen_stagedag"))
  );
  const [dagFout, setDagFout] = useState("");

  // Actieve dag = de eerste niet-ingevulde dag (standaard dag 0)
  const [activeDag, setActiveDag] = useState(() => {
    const eerste = logbook.dagen.findIndex((_, i) => !ingediendeDagen[i] ?? true);
    return eerste >= 0 ? eerste : 0;
  });

  const vandaagIso = new Date().toISOString().slice(0, 10);

  // Datum per dag berekenen
  function dagDatum(index) {
    if (logbook.dagen[index]?.datum) return logbook.dagen[index].datum;
    if (!logbook.weekStart) return "";
    const d = new Date(logbook.weekStart + "T12:00:00");
    d.setDate(d.getDate() + index);
    return d.toISOString().slice(0, 10);
  }

  function fmtLang(iso) {
    if (!iso) return DAG_NAMEN[0];
    return new Date(iso + "T12:00:00").toLocaleDateString("nl-BE", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  }
  function fmtKort(iso) {
    if (!iso) return "";
    return new Date(iso + "T12:00:00").toLocaleDateString("nl-BE", {
      day: "numeric", month: "short",
    });
  }
  function dagAfk(index) {
    return ["Ma", "Di", "Wo", "Do", "Vr"][index] ?? "";
  }

  const totaalUren = logbook.dagen.reduce((s, d) => s + (Number(d.aantalUren) || 0), 0);

  function handleDagChange(e) {
    const updatedDagen = [...logbook.dagen];
    updatedDagen[activeDag] = {
      ...updatedDagen[activeDag],
      [e.target.name]: e.target.name === "aantalUren" ? Number(e.target.value) : e.target.value,
    };
    setLogbook({ ...logbook, dagen: updatedDagen });
  }

  function handleDagOpslaan() {
    // Validatie: gewone stagedag vereist minstens taken + reflectie
    const dag = logbook.dagen[activeDag] || {};
    if (dag.status !== "geen_stagedag") {
      if (!String(dag.uitgevoerdeTaken || "").trim() || !String(dag.reflectie || "").trim()) {
        setDagFout("Vul minstens je uitgevoerde taken en je reflectie in, of markeer de dag als 'Geen stagedag'.");
        return;
      }
    }
    setDagFout("");
    // Sla _bevestigd in de dag zelf op — zo overleeft de staat een page-navigatie
    const updatedDagen = [...logbook.dagen];
    updatedDagen[activeDag] = { ...updatedDagen[activeDag], _bevestigd: true };
    setLogbook({ ...logbook, dagen: updatedDagen });

    const updated = [...ingediendeDagen];
    updated[activeDag] = true;
    setIngediendeDagen(updated);
    // Ga automatisch naar volgende open dag
    const volgende = updated.findIndex((v, i) => !v && i !== activeDag);
    if (volgende >= 0) setActiveDag(volgende);
  }

  function handleGeenStagedag() {
    const updatedDagen = [...logbook.dagen];
    updatedDagen[activeDag] = {
      ...updatedDagen[activeDag],
      aantalUren: 0, titel: "", uitgevoerdeTaken: "", reflectie: "", problemen: "",
      competenties: [], status: "geen_stagedag", _bevestigd: true,
    };
    setLogbook({ ...logbook, dagen: updatedDagen });
    const updated = [...ingediendeDagen];
    updated[activeDag] = true;
    setIngediendeDagen(updated);
    const volgende = updated.findIndex((v, i) => !v && i !== activeDag);
    if (volgende >= 0) setActiveDag(volgende);
  }

  function toggleCompetentie(code) {
    const updatedDagen = [...logbook.dagen];
    const huidig = updatedDagen[activeDag].competenties ?? [];
    updatedDagen[activeDag] = {
      ...updatedDagen[activeDag],
      competenties: huidig.includes(code) ? huidig.filter((c) => c !== code) : [...huidig, code],
    };
    setLogbook({ ...logbook, dagen: updatedDagen });
  }

  const allesDagBevestigd = ingediendeDagen.every(Boolean);
  const dag = logbook.dagen[activeDag];
  const ddatum = dagDatum(activeDag);
  const isVandaag = ddatum === vandaagIso;

  // Weekdatum bereik label bv. "1–5 jun"
  const weekBereikLabel = logbook.weekStart
    ? `${fmtKort(logbook.weekStart)}–${fmtKort(logbook.weekEinde)}`
    : "";

  return (
    <form onSubmit={onSubmit}>
      {/* Hidden velden */}
      <input type="hidden" name="weekStart" value={logbook.weekStart} />
      <input type="hidden" name="weekEinde" value={logbook.weekEinde} />
      {logbook.dagen.map((d, i) => (
        <input key={i} type="hidden" name={`datum_${i}`} value={dagDatum(i)} />
      ))}

      {/* ── ACTIEVE DAG FORM ── */}
      <div className="card vdag-card">
        {/* Header */}
        <div className="vdag-header">
          <div className="vdag-header-links">
            <div className="vdag-titel">
              {isVandaag && <span className="vdag-label">Vandaag · </span>}
              <span className="vdag-datum">{fmtLang(ddatum)}</span>
            </div>
            <div className="vdag-subtitle">
              Week {logbook.weekNummer}{aantalWeken ? ` van ${aantalWeken}` : ""}
              {" · "}
              {ingediendeDagen[activeDag]
                ? (dag?.status === "geen_stagedag" ? "Geen stagedag" : "Ingevuld")
                : "nog niet ingevuld"}
            </div>
          </div>
          <span className={`status ${ingediendeDagen[activeDag] ? "s_ok" : "s_open"}`}>
            {ingediendeDagen[activeDag]
              ? (dag?.status === "geen_stagedag" ? "Geen stagedag" : <><IconCircleCheck size={11}/> Ingevuld</>)
              : "Open"}
          </span>
        </div>

        {/* Form body — verborgen als dag al ingevuld */}
        {!ingediendeDagen[activeDag] && (
          <div className="vdag-body">
            <div className="form_row">
              <div className="form_group">
                <label className="form_label">Titel</label>
                <input
                  className="form_input"
                  type="text"
                  name="titel"
                  value={dag?.titel ?? ""}
                  onChange={handleDagChange}
                  placeholder="bv. API-integratie getest"
                />
              </div>
              <div className="form_group vdag-uren">
                <label className="form_label">Gepresteerde uren</label>
                <input
                  className="form_input"
                  type="number"
                  name="aantalUren"
                  value={dag?.aantalUren ?? 0}
                  onChange={handleDagChange}
                  placeholder="8"
                  min="0"
                  max="12"
                  step="0.25"
                />
              </div>
            </div>

            <div className="form_group">
              <label className="form_label">Taken</label>
              <textarea
                className="form_textarea"
                name="uitgevoerdeTaken"
                value={dag?.uitgevoerdeTaken ?? ""}
                onChange={handleDagChange}
                placeholder="Wat heb je gedaan?"
              />
            </div>

            <div className="form_group">
              <label className="form_label">Reflectie</label>
              <textarea
                className="form_textarea"
                name="reflectie"
                value={dag?.reflectie ?? ""}
                onChange={handleDagChange}
                placeholder="Hoe verliep de dag?"
              />
            </div>

            <div className="form_group">
              <label className="form_label">Problemen &amp; leerpunten</label>
              <textarea
                className="form_textarea"
                name="problemen"
                value={dag?.problemen ?? ""}
                onChange={handleDagChange}
                placeholder="Wat liep moeilijk? Wat heb je geleerd?"
              />
            </div>

            <div className="form_group">
              <label className="form_label">Aan welke competenties werkte je vandaag?</label>
              <div className="lo-chips">
                {competentieLijst.map((lo) => {
                  const geselecteerd = (dag?.competenties ?? []).includes(lo.code);
                  return (
                    <button
                      key={lo.code}
                      type="button"
                      className={`lo-chip${geselecteerd ? " actief" : ""}`}
                      onClick={() => toggleCompetentie(lo.code)}
                    >
                      <span className="lo-code">{lo.code}</span>
                      <span className="lo-naam">{lo.naam}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {dagFout && (
              <p className="status s_rood" style={{ marginTop: 10 }}>{dagFout}</p>
            )}

            <div className="vdag-actions">
              <button type="button" className="btn primary" onClick={handleDagOpslaan}>
                <IconCircleCheck size={15} /> Dag toevoegen aan week
              </button>
              <button type="button" className="btn ghost" onClick={handleGeenStagedag}>
                <IconCalendarOff size={15} /> Vandaag was geen stagedag
              </button>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--sub)", marginTop: 8 }}>
              Een dag wordt pas definitief bewaard wanneer je onderaan <strong>Week indienen</strong> klikt.
            </p>
          </div>
        )}
      </div>

      {/* ── WEEK OVERZICHT ── */}
      <div className="card week-overzicht-card">
        <div className="week-overzicht-header">
          <span className="week-overzicht-titel">Week {logbook.weekNummer}</span>
          {weekBereikLabel && (
            <span className="week-overzicht-bereik">{weekBereikLabel}</span>
          )}
          <div className="week-dag-afk">
            {[0,1,2,3,4].map((i) => {
              const ingevuld = ingediendeDagen[i];
              const actief = i === activeDag;
              return (
                <span
                  key={i}
                  className={`wda${actief ? " actief" : ""}${ingevuld ? " klaar" : ""}`}
                  onClick={() => { if (!ingevuld) setActiveDag(i); }}
                  style={{ cursor: ingevuld ? "default" : "pointer" }}
                >
                  {dagAfk(i)}
                </span>
              );
            })}
          </div>
          <span className="status s_grijs" style={{ fontSize: 11 }}>
            {allesDagBevestigd ? "Klaar om in te dienen" : "Concept"}
          </span>
        </div>

        {/* Dag rijen */}
        {logbook.dagen.map((d, i) => {
          const dd = dagDatum(i);
          const ingevuld = ingediendeDagen[i];
          const geenStage = d.status === "geen_stagedag" && ingevuld;
          const actief = i === activeDag;
          const isHvandaag = dd === vandaagIso;

          return (
            <div
              key={i}
              className={`week-dag-rij${actief ? " actief" : ""}${ingevuld && !geenStage ? " ingevuld" : ""}${geenStage ? " geen-stage" : ""}`}
            >
              <span className="week-dag-naam">{DAG_NAMEN[i]}</span>
              <span className="week-dag-info">
                {actief && !ingevuld
                  ? (isHvandaag ? "Vandaag — formulier hierboven" : "Formulier hierboven")
                  : geenStage
                  ? "Geen stagedag"
                  : ingevuld
                  ? (d.titel || "Ingevuld")
                  : <span style={{ color: "var(--red)" }}>Niet ingevuld — vul deze dag alsnog aan</span>
                }
              </span>
              {ingevuld && !geenStage && (
                <span className="status s_ok" style={{ fontSize: 11 }}>
                  <IconCircleCheck size={11} /> Ingevuld
                </span>
              )}
              {geenStage && (
                <span className="status s_grijs" style={{ fontSize: 11 }}>Geen stagedag</span>
              )}
              {!ingevuld && !actief && (
                <button
                  type="button"
                  className="btn ghost sm week-dag-invullen"
                  onClick={() => setActiveDag(i)}
                >
                  <IconPencil size={12} /> Invullen
                </button>
              )}
              {actief && !ingevuld && (
                <span className="status s_open" style={{ fontSize: 11 }}>Open</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Week indienen knop — alleen als alle dagen ingevuld */}
      {allesDagBevestigd && (
        <div className="actions">
          <button type="submit" className="btn primary" disabled={saving}>
            <IconSend size={16} />
            {saving ? "Bezig…" : isBewerken ? "Opnieuw indienen" : "Week indienen"}
          </button>
        </div>
      )}
    </form>
  );
}

/* ---------- Hoofdcomponent ---------- */
export default function StudentLogbookPage() {
  const { user } = useAuth();
  const [loadingWeken, setLoadingWeken] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [weken, setWeken] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [ingediendWeekNr, setIngediendWeekNr] = useState(null);
  const [startDatum, setStartDatum] = useState(null);
  const [eindDatum, setEindDatum]   = useState(null);

  // Gate: logboek alleen toegankelijk als voorstel goedgekeurd + contract getekend
  const [voorstelStatus, setVoorstelStatus] = useState(null);
  const [contractGetekend, setContractGetekend] = useState(false);
  const [dossierStatus, setDossierStatus] = useState(null);
  const [loadingGate, setLoadingGate] = useState(true);
  // Competentiechips komen uit het actieve competentieprofiel (configureerbaar), met de vaste lijst als fallback.
  const [competentieLijst, setCompetentieLijst] = useState(LO_COMPETENTIES);
  // Minimum aantal uren komt uit de actieve stageregel (configureerbaar in instellingen); 456 als fallback.
  const [minUren, setMinUren] = useState(456);

  // null = nieuwe week invullen, week-object = bestaande week bewerken
  const [editWeek, setEditWeek] = useState(null);
  const [logbook, setLogbook] = useState(defaultLogbook(1));

  /* Weken ophalen van backend */
  async function fetchWeken(sd = null) {
    try {
      const KEY = `student_logbook_${user.id}`;
      const cached = cacheGet(KEY);
      const data = cached ?? (() => apiRequest("GET", `/logbooks/${user.id}`).then(r => Array.isArray(r.data) ? r.data : []))();
      const resolved = data instanceof Promise ? await data : data;
      if (!cached) cacheSet(KEY, resolved);
      setWeken(resolved);

      if (!editWeek) {
        const maxWeek = resolved.length > 0 ? Math.max(...resolved.map((w) => w.week_nummer)) : 0;
        const verwachtWeekNr = maxWeek + 1;

        // Herstel concept-week als de draft in localStorage past bij de verwachte week
        let herstellenGelukt = false;
        try {
          const opgeslagen = localStorage.getItem(DRAFT_KEY(user.id));
          if (opgeslagen) {
            const draft = JSON.parse(opgeslagen);
            if (draft.weekNummer === verwachtWeekNr) {
              setLogbook(draft);
              herstellenGelukt = true;
            } else {
              // Draft hoort bij een andere week (al ingediend) — verwijder
              localStorage.removeItem(DRAFT_KEY(user.id));
            }
          }
        } catch { /* ongeldige JSON — negeren */ }

        if (!herstellenGelukt) {
          setLogbook(defaultLogbook(verwachtWeekNr, sd));
        }
      }
    } catch (err) {
      console.error("Kan logboeken niet ophalen:", err);
    } finally {
      setLoadingWeken(false);
    }
  }

  useEffect(() => {
    setLoadingWeken(true);

    async function init() {
      let sd = null;

      // Stagevoorstel + contract parallel ophalen (met cache)
      const cachedIntern   = cacheGet("student_internship");
      const cachedContract = cacheGet("student_contract");
      const [internRes, contractRes] = await Promise.allSettled([
        cachedIntern   ? Promise.resolve({ data: cachedIntern })   : apiRequest("GET", "/internships/my"),
        cachedContract ? Promise.resolve({ data: cachedContract }) : apiRequest("GET", "/contracts/my"),
      ]);

      if (internRes.status === "fulfilled" && internRes.value?.data) {
        const data = internRes.value.data;
        if (!cachedIntern) cacheSet("student_internship", data);
        setVoorstelStatus(data.status);
        setDossierStatus(data.dossier_status ?? data.dossierStatus ?? null);
        const rawStart = data.startdatum ?? data.startDatum;
        const rawEind  = data.einddatum  ?? data.eindDatum;
        if (rawStart) {
          sd = new Date(rawStart);
          setStartDatum(sd);
        }
        if (rawEind) setEindDatum(new Date(rawEind));
      }

      if (contractRes.status === "fulfilled" && contractRes.value?.data) {
        const c = contractRes.value.data;
        if (!cachedContract) cacheSet("student_contract", c);
        if (c?.student_getekend_op) setContractGetekend(true);
      }

      // Competenties uit het actieve profiel laden voor de logboekchips.
      try {
        const compRes = await apiRequest("GET", "/competencies");
        const comps = compRes?.data?.competenties || [];
        if (comps.length > 0) setCompetentieLijst(comps.map((c) => ({ code: c.code, naam: c.naam })));
      } catch { /* valt terug op de vaste lijst */ }

      // Minimum uren uit de actieve stageregel (configureerbaar in instellingen).
      try {
        const setRes = await apiRequest("GET", "/internships/settings");
        const regel = setRes?.data?.stageRegels?.[0];
        const mu = Number(regel?.minimum_uren);
        if (Number.isFinite(mu) && mu > 0) setMinUren(mu);
      } catch { /* valt terug op 456 */ }

      setLoadingGate(false);

      // Weken ophalen met gekende startDatum zodat datums auto-ingevuld worden
      await fetchWeken(sd);
    }

    init();
  }, [user.id]);

  // Sla de huidige concept-week op in localStorage zodra minstens één dag bevestigd is.
  // Zo blijft de voortgang bewaard als de student wegnavigiert.
  useEffect(() => {
    if (editWeek || submitted) return; // alleen voor nieuwe weken
    const eenBevestigd = logbook.dagen.some((d) => d._bevestigd || d.status === "geen_stagedag");
    if (eenBevestigd) {
      try {
        localStorage.setItem(DRAFT_KEY(user.id), JSON.stringify(logbook));
      } catch { /* quota overschreden — stil negeren */ }
    }
  }, [logbook, editWeek, submitted, user.id]);

  /* Beschikbaarheidslogica */
  const vandaag = new Date();
  const verschilDagen = startDatum
    ? Math.floor((vandaag - startDatum) / (1000 * 60 * 60 * 24))
    : 0;
  const beschikbareWeek = Math.max(1, Math.ceil((verschilDagen + 1) / 7));

  // Totaal aantal weken op basis van stageperiode (start → eind)
  const aantalWeken = startDatum && eindDatum
    ? Math.ceil((eindDatum - startDatum) / (1000 * 60 * 60 * 24 * 7))
    : null;

  const huidigFormulierWeek = editWeek ? editWeek.week_nummer : logbook.weekNummer;
  const weekAlIngediend =
    !editWeek && weken.some((w) => w.week_nummer === huidigFormulierWeek);
  const vorigeWeekOk =
    huidigFormulierWeek === 1 ||
    weken.some((w) => w.week_nummer === huidigFormulierWeek - 1);
  // Week beschikbaar als: vorige week ingediend OF de tijd voor deze week is aangebroken
  const weekBeschikbaar =
    editWeek != null ||
    (!weekAlIngediend && (vorigeWeekOk || huidigFormulierWeek <= beschikbareWeek));

  /* Week indienen / opnieuw indienen → POST /api/logbooks (upsert) */
  async function handleWeekIndienen(e) {
    e.preventDefault();
    setError(null);

    // Client-side validatie vóór de API-call
    if (!logbook.weekStart || !logbook.weekEinde) {
      setError("Vul de startdatum en einddatum van de week in.");
      return;
    }

    if (logbook.weekStart > logbook.weekEinde) {
      setError("De startdatum moet voor of op de einddatum liggen.");
      return;
    }

    if (Number(logbook.weekNummer) < 1) {
      setError("Weeknummer moet minimaal 1 zijn.");
      return;
    }

    setSaving(true);

    try {
      cacheDelete(`student_logbook_${user.id}`);
      await apiRequest("POST", "/logbooks", {
        stagedossierId: logbook.stagedossierId,
        weekNummer: Number(logbook.weekNummer),
        weekStart: logbook.weekStart,
        weekEinde: logbook.weekEinde,
        dagen: logbook.dagen.map((dag, i) => {
          // Datum berekenen als dag.datum leeg is
          let datum = dag.datum;
          if (!datum && logbook.weekStart) {
            const d = new Date(logbook.weekStart + "T12:00:00");
            d.setDate(d.getDate() + i);
            datum = d.toISOString().slice(0, 10);
          }
          return {
          datum,
          titel: dag.titel,
          uitgevoerdeTaken: dag.uitgevoerdeTaken,
          reflectie: dag.reflectie,
          problemen: dag.problemen,
          aantalUren: Number(dag.aantalUren) || 0,
          status: dag.status === "geen_stagedag" ? "geen_stagedag" : "ingediend",
          competenties: dag.competenties ?? [],
          };
        }),
      });

      const weekNrIngediend = Number(logbook.weekNummer);
      // Draft verwijderen — week is succesvol ingediend
      try { localStorage.removeItem(DRAFT_KEY(user.id)); } catch { /* stil */ }
      setEditWeek(null);
      await fetchWeken(startDatum);
      setSubmitted(true);
      setIngediendWeekNr(weekNrIngediend);
    } catch (err) {
      const backendMsg = err.response?.data?.message;
      if (backendMsg?.toLowerCase().includes("stagedossier")) {
        setError("Je hebt nog geen actief stagedossier. Neem contact op met je stagebegeleider.");
      } else if (backendMsg?.includes("afgesloten")) {
        setError("Deze week is afgesloten en kan niet meer aangepast worden.");
      } else {
        const detail = err.response?.data?.error || "";
        setError((backendMsg || "Week indienen mislukt") + (detail ? ` — ${detail}` : ""));
      }
      console.error("Indienen fout:", err.response?.data || err.message);
    } finally {
      setSaving(false);
    }
  }

  /* Bewerken starten: week data inladen in formulier */
  function handleBewerken(week) {
    const formulierData = weekNaarFormulier(week);
    setEditWeek(week);
    setLogbook(formulierData);
    setSubmitted(false);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* Bewerken annuleren */
  function handleAnnuleerBewerken() {
    setEditWeek(null);
    setError(null);
    const maxWeek =
      weken.length > 0 ? Math.max(...weken.map((w) => w.week_nummer)) : 0;
    setLogbook(defaultLogbook(maxWeek + 1, startDatum));
  }

  /* Nieuwe week starten */
  function handleNieuweWeek() {
    setSubmitted(false);
    setEditWeek(null);
    setError(null);
    const maxWeek =
      weken.length > 0 ? Math.max(...weken.map((w) => w.week_nummer)) : 0;
    const verwachtWeekNr = maxWeek + 1;
    // Herstel draft als die er nog is voor de volgende week
    try {
      const opgeslagen = localStorage.getItem(DRAFT_KEY(user.id));
      if (opgeslagen) {
        const draft = JSON.parse(opgeslagen);
        if (draft.weekNummer === verwachtWeekNr) {
          setLogbook(draft);
          return;
        }
      }
    } catch { /* ongeldige JSON */ }
    setLogbook(defaultLogbook(verwachtWeekNr, startDatum));
  }

  /* ---------- Render ---------- */
  if (loadingWeken || loadingGate) {
    return (
      <div className="page-inner">
        <div className="page-header">
          <h1>Logboek</h1>
        </div>
        <div className="card">
          <p style={{ fontSize: 13, color: "var(--sub)" }}>Laden…</p>
        </div>
      </div>
    );
  }

  // Gate: stagevoorstel moet goedgekeurd zijn
  if (voorstelStatus !== "goedgekeurd") {
    const uitleg =
      !voorstelStatus || voorstelStatus === "concept" || voorstelStatus === "ingediend"
        ? "Je stagevoorstel is nog niet goedgekeurd door de stagecommissie."
        : voorstelStatus === "aanpassingen_gevraagd"
        ? "De stagecommissie heeft aanpassingen gevraagd aan je stagevoorstel."
        : voorstelStatus === "afgekeurd"
        ? "Je stagevoorstel werd afgekeurd."
        : "Je stagevoorstel heeft status: " + voorstelStatus + ".";
    return (
      <div className="page-inner">
        <div className="page-header">
          <h1>Logboek</h1>
        </div>
        <div className="card">
          <div className="card_title" style={{ color: "var(--red)" }}>
            <IconLock size={16} />
            Logboek nog niet beschikbaar
          </div>
          <p style={{ fontSize: 13, color: "var(--sub)" }}>
            {uitleg} Je kan het logboek pas invullen zodra je voorstel is goedgekeurd en de stageovereenkomst getekend is.
          </p>
        </div>
      </div>
    );
  }

  // Gate: stageovereenkomst moet getekend zijn door student
  if (!contractGetekend) {
    return (
      <div className="page-inner">
        <div className="page-header">
          <h1>Logboek</h1>
        </div>
        <div className="card">
          <div className="card_title" style={{ color: "var(--red)" }}>
            <IconLock size={16} />
            Stageovereenkomst nog niet getekend
          </div>
          <p style={{ fontSize: 13, color: "var(--sub)" }}>
            Teken eerst de stageovereenkomst voor je het logboek kan invullen. Ga naar <strong>Mijn stage → Overeenkomst</strong>.
          </p>
        </div>
      </div>
    );
  }

  // Gate: na vrijgave/afronding is het logboek read-only — net zoals de backend nieuwe inzendingen weigert.
  if (["resultaat_vrijgegeven", "afgerond", "voltooid"].includes(dossierStatus)) {
    return (
      <div className="page-inner">
        <div className="page-header">
          <h1>Logboek</h1>
        </div>
        <div className="card">
          <div className="card_title">
            <IconCircleCheck size={16} />
            Stage afgerond
          </div>
          <p style={{ fontSize: 13, color: "var(--sub)" }}>
            Je stage is afgerond. Je logboek is bewaard maar kan niet meer aangepast worden. Bekijk je
            ingediende weken hieronder.
          </p>
        </div>
        {weken.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {[...weken].sort((a, b) => b.week_nummer - a.week_nummer).map((week) => (
              <LogboekWeek key={week.id} week={week} onBewerken={() => {}} onVernieuwen={() => {}} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // "Bevestigd" telt enkel weken die de mentor aftekende of de docent goedkeurde — niet elke ingediende week.
  const BEVESTIGD_STATUSSEN = ["afgecheckt_door_mentor", "goedgekeurd_door_docent"];
  const totaalUrenIngediend = weken.reduce(
    (sum, w) => sum + (Number(w.totaal_uren) || 0),
    0
  );
  const totaalUrenBevestigd = weken.reduce(
    (sum, w) => sum + (BEVESTIGD_STATUSSEN.includes(w.status) ? (Number(w.totaal_uren) || 0) : 0),
    0
  );
  // Uren van de lopende (nog niet ingediende) week — telt mee zodra een dag bevestigd is
  const urenHuidigWeek = (!editWeek && !submitted)
    ? logbook.dagen.reduce(
        (s, d) => s + ((d._bevestigd || d.status === "geen_stagedag") ? (Number(d.aantalUren) || 0) : 0),
        0
      )
    : 0;
  const totaalUrenTonen = totaalUrenIngediend + urenHuidigWeek;
  const MIN_UREN = minUren;
  const urenPct = Math.min(100, Math.round((totaalUrenTonen / MIN_UREN) * 100));
  const urenResterend = Math.max(0, MIN_UREN - totaalUrenTonen);
  const urenNogTeBevestigen = Math.max(0, totaalUrenIngediend - totaalUrenBevestigd);

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1>Logboek</h1>
        <p>
          {editWeek
            ? `Week ${editWeek.week_nummer} aanpassen en opnieuw indienen`
            : submitted
            ? "Week ingediend — je mentor krijgt een melding."
            : "Vul wekelijks je activiteiten in"}
        </p>
      </div>

      {/* Uren voortgangsbalk */}
      <div style={{ marginBottom: 16, padding: "10px 2px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 12, color: "var(--sub)" }}>
              Gepresteerde uren
              {urenHuidigWeek > 0 && (
                <span style={{ marginLeft: 6, color: "var(--red)" }}>
                  (inclusief {urenHuidigWeek}u huidige week)
                </span>
              )}
            </div>
            <div className="prog-wrap" style={{ marginTop: 7 }}>
              <div className="prog-fill" style={{ width: `${urenPct}%` }} />
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: "var(--red)" }}>
              {totaalUrenTonen}
            </span>
            <span style={{ fontSize: 12, color: "var(--sub)" }}> / min. {MIN_UREN}u</span>
            <div style={{ fontSize: 11, color: "var(--sub)" }}>
              {urenResterend > 0 ? `nog ${urenResterend}u te gaan` : "minimum behaald ✓"}
              {urenNogTeBevestigen > 0 && ` · ${urenNogTeBevestigen}u ingediend, wacht op bevestiging`}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="card">
          <p className="status s_rood">{error}</p>
        </div>
      )}

      {/* Bewerkmodus: formulier bovenaan tonen */}
      {editWeek && (
        <>
          <div className="card" style={{ borderColor: "var(--red-mid)" }}>
            <div className="card_title" style={{ color: "var(--red)" }}>
              <IconAlertCircle size={16} />
              Je past week {editWeek.week_nummer} aan op basis van de ontvangen feedback
            </div>
            <p style={{ fontSize: 13, color: "var(--sub)" }}>
              Verwerk de opmerkingen hieronder en dien de week opnieuw in.
            </p>
            <div style={{ marginTop: 10 }}>
              <button
                className="btn sm"
                onClick={handleAnnuleerBewerken}
              >
                Annuleren
              </button>
            </div>
          </div>

          <WeekFormulier
            logbook={logbook}
            setLogbook={setLogbook}
            onSubmit={handleWeekIndienen}
            saving={saving}
            isBewerken={true}
            aantalWeken={aantalWeken}
            competentieLijst={competentieLijst}
          />
        </>
      )}

      {/* Ingediende weken — altijd zichtbaar, nieuwste eerst */}
      {!editWeek && weken.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: "12.5px", color: "var(--sub)", marginBottom: 8 }}>
            Ingediende weken
          </p>
          {[...weken]
            .sort((a, b) => b.week_nummer - a.week_nummer)
            .map((week) => (
              <LogboekWeek
                key={week.id}
                week={week}
                onBewerken={handleBewerken}
                onVernieuwen={() => { cacheDelete(`student_logbook_${user.id}`); fetchWeken(startDatum); }}
              />
            ))}
        </div>
      )}

      {/* Na indienen: knop voor nieuwe week */}
      {!editWeek && submitted && (
        <div className="card">
          <div className="actions">
            <button className="btn primary" onClick={handleNieuweWeek}>
              <IconPlus size={16} />
              Nieuwe week invullen
            </button>
          </div>
        </div>
      )}

      {/* Formulier voor nieuwe week */}
      {!editWeek && !submitted && (
        <>
          {weekAlIngediend && (
            <div className="card">
              <div className="card_title">
                <IconCircleCheck size={16} />
                Week {logbook.weekNummer} al ingediend
              </div>
              <p style={{ fontSize: 13, color: "var(--sub)" }}>
                Deze week staat al in het systeem. Wil je de volgende week invullen?
              </p>
              <div className="actions" style={{ marginTop: 12 }}>
                <button className="btn primary" onClick={handleNieuweWeek}>
                  <IconPlus size={16} />
                  Volgende week invullen
                </button>
              </div>
            </div>
          )}

          {!weekBeschikbaar && !weekAlIngediend && (
            <div className="card">
              <div className="card_title">
                <IconLock size={16} />
                Week {logbook.weekNummer} nog niet beschikbaar
              </div>
              <p style={{ fontSize: 13, color: "var(--sub)" }}>
                {logbook.weekNummer === 1
                  ? "Je stage is nog niet gestart."
                  : `Week ${logbook.weekNummer} wordt beschikbaar zodra week ${logbook.weekNummer - 1} is ingediend of de bijhorende week is aangebroken.`}
              </p>
            </div>
          )}

          {weekBeschikbaar && !weekAlIngediend && (
            <WeekFormulier
              logbook={logbook}
              setLogbook={setLogbook}
              onSubmit={handleWeekIndienen}
              saving={saving}
              isBewerken={false}
              aantalWeken={aantalWeken}
              competentieLijst={competentieLijst}
            />
          )}
        </>
      )}

      {/* Modal: week succesvol ingediend */}
      <Modal
        open={!!ingediendWeekNr}
        onClose={() => setIngediendWeekNr(null)}
        icon="ti-send"
        titel={`Week ${ingediendWeekNr} ingediend`}
        sub="Je mentor krijgt een melding."
        footer={
          <button className="btn primary" onClick={() => setIngediendWeekNr(null)}>
            <i className="ti ti-check"></i> Begrepen
          </button>
        }
      >
        <p>
          Je logboek voor week {ingediendWeekNr} is verstuurd. Je mentor ontvangt
          een melding en controleert je uren en activiteiten.
        </p>
      </Modal>
    </div>
  );
}
