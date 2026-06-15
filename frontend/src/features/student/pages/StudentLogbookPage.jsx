import { useState, useEffect } from "react";
import { apiRequest } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import {
  IconCalendar,
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
          {(week.dagen || []).map((dag, i) => (
            <div className="dag-rij" key={i}>
              <span className="dag-naam">{dagNaam(dag.datum, i)}</span>
              <span className="dag-samenvatting">
                {dag.titel || dag.uitgevoerde_taken || "–"}
              </span>
              <span style={{ fontSize: "12px", color: "var(--sub)", flexShrink: 0 }}>
                {dag.aantal_uren}u
              </span>
            </div>
          ))}

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
    <div style={{ marginTop: 8 }}>
      {week.student_antwoord && !open && (
        <div className="fb-blok" style={{ borderLeftColor: "var(--blue, #3b82f6)" }}>
          <div className="fb-wie" style={{ color: "var(--blue, #3b82f6)" }}>
            Jouw antwoord
          </div>
          <div className="fb-wat">"{week.student_antwoord}"</div>
        </div>
      )}
      {!open && (
        <button
          className="btn ghost sm"
          style={{ paddingLeft: 0, fontSize: 12.5 }}
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

function leegDag() {
  return {
    datum: "",
    titel: "",
    uitgevoerdeTaken: "",
    reflectie: "",
    problemen: "",
    aantalUren: 0,
  };
}

function defaultLogbook(weekNummer = 1) {
  return {
    stagedossierId: "",
    weekNummer,
    weekStart: "",
    weekEinde: "",
    dagen: [leegDag(), leegDag(), leegDag(), leegDag(), leegDag()],
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
    })),
  };
}

/* ---------- Week formulier (nieuw + bewerken) ---------- */
function WeekFormulier({ logbook, setLogbook, onSubmit, saving, isBewerken }) {
  const [ingediendeDagen, setIngediendeDagen] = useState(
    logbook.dagen.map(() => false)
  );
  const [openvouwDagen, setOpenvouwDagen] = useState(
    logbook.dagen.map(() => true)
  );

  const totaalUren = logbook.dagen.reduce(
    (sum, dag) => sum + (Number(dag.aantalUren) || 0),
    0
  );

  function handleWeekChange(e) {
    setLogbook({ ...logbook, [e.target.name]: e.target.value });
  }

  function handleDagChange(index, e) {
    const updatedDagen = [...logbook.dagen];
    updatedDagen[index] = {
      ...updatedDagen[index],
      [e.target.name]:
        e.target.name === "aantalUren"
          ? Number(e.target.value)
          : e.target.value,
    };
    setLogbook({ ...logbook, dagen: updatedDagen });
  }

  function handleDagBevestigen(index) {
    const dag = logbook.dagen[index];
    if (!dag.datum) {
      alert(`Vul een datum in voor dag ${index + 1} voor je bevestigt.`);
      return;
    }
    const updated = [...ingediendeDagen];
    updated[index] = true;
    setIngediendeDagen(updated);
    const updatedOpen = [...openvouwDagen];
    updatedOpen[index] = false;
    setOpenvouwDagen(updatedOpen);
  }

  function toggleDag(index) {
    const updated = [...openvouwDagen];
    updated[index] = !updated[index];
    setOpenvouwDagen(updated);
  }

  const allesDagBevestigd = ingediendeDagen.every(Boolean);

  return (
    <form onSubmit={onSubmit}>
      {/* Week info */}
      <div className="card">
        <div className="card_title">
          <IconCalendar size={16} />
          {isBewerken
            ? `Week ${logbook.weekNummer} aanpassen`
            : "Week informatie"}
        </div>
        <div className="form_row">
          <div className="form_group">
            <label className="form_label">
              Weeknummer<span className="req">*</span>
            </label>
            <input
              className="form_input"
              type="number"
              name="weekNummer"
              value={logbook.weekNummer}
              onChange={handleWeekChange}
              min="1"
              readOnly={isBewerken}
            />
          </div>
          <div className="form_group">
            <label className="form_label">Totaal uren</label>
            <input
              className="form_input"
              type="number"
              value={totaalUren}
              readOnly
            />
          </div>
        </div>
        <div className="form_row">
          <div className="form_group">
            <label className="form_label">
              Week start<span className="req">*</span>
            </label>
            <input
              className="form_input"
              type="date"
              name="weekStart"
              value={logbook.weekStart}
              onChange={handleWeekChange}
            />
          </div>
          <div className="form_group">
            <label className="form_label">
              Week einde<span className="req">*</span>
            </label>
            <input
              className="form_input"
              type="date"
              name="weekEinde"
              value={logbook.weekEinde}
              onChange={handleWeekChange}
            />
          </div>
        </div>
      </div>

      {/* 5 dagen */}
      {logbook.dagen.map((dag, index) => (
        <div className="card" key={index}>
          <div
            className="card_title"
            onClick={() => toggleDag(index)}
            style={{ cursor: "pointer", justifyContent: "space-between" }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              Dag {index + 1} — {DAG_NAMEN[index]}
              {ingediendeDagen[index] && (
                <span className="status s_ok">
                  <IconCircleCheck size={12} />
                  Ingevuld
                </span>
              )}
            </span>
            {openvouwDagen[index] ? (
              <IconChevronUp size={16} />
            ) : (
              <IconChevronDown size={16} />
            )}
          </div>

          {openvouwDagen[index] && (
            <>
              <div className="form_row">
                <div className="form_group">
                  <label className="form_label">Datum</label>
                  <input
                    className="form_input"
                    type="date"
                    name="datum"
                    value={dag.datum}
                    onChange={(e) => handleDagChange(index, e)}
                    disabled={ingediendeDagen[index]}
                  />
                </div>
                <div className="form_group">
                  <label className="form_label">Aantal uren</label>
                  <input
                    className="form_input"
                    type="number"
                    name="aantalUren"
                    value={dag.aantalUren}
                    onChange={(e) => handleDagChange(index, e)}
                    placeholder="8"
                    disabled={ingediendeDagen[index]}
                  />
                </div>
              </div>

              <div className="form_group">
                <label className="form_label">Titel</label>
                <input
                  className="form_input"
                  type="text"
                  name="titel"
                  value={dag.titel}
                  onChange={(e) => handleDagChange(index, e)}
                  placeholder="Wat was het hoofdthema van de dag?"
                  disabled={ingediendeDagen[index]}
                />
              </div>

              <div className="form_group">
                <label className="form_label">Uitgevoerde taken</label>
                <textarea
                  className="form_textarea"
                  name="uitgevoerdeTaken"
                  value={dag.uitgevoerdeTaken}
                  onChange={(e) => handleDagChange(index, e)}
                  placeholder="Wat heb je gedaan?"
                  disabled={ingediendeDagen[index]}
                />
              </div>

              <div className="form_group">
                <label className="form_label">Reflectie</label>
                <textarea
                  className="form_textarea"
                  name="reflectie"
                  value={dag.reflectie}
                  onChange={(e) => handleDagChange(index, e)}
                  placeholder="Hoe verliep de dag?"
                  disabled={ingediendeDagen[index]}
                />
              </div>

              <div className="form_group">
                <label className="form_label">Problemen / leerpunten</label>
                <textarea
                  className="form_textarea"
                  name="problemen"
                  value={dag.problemen}
                  onChange={(e) => handleDagChange(index, e)}
                  placeholder="Wat liep moeilijk? Wat heb je geleerd?"
                  disabled={ingediendeDagen[index]}
                />
              </div>

              {!ingediendeDagen[index] && (
                <div className="actions">
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => handleDagBevestigen(index)}
                  >
                    <IconCircleCheck size={16} />
                    Dag {index + 1} bevestigen
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ))}

      {allesDagBevestigd && (
        <div className="actions">
          <button type="submit" className="btn primary" disabled={saving}>
            <IconSend size={16} />
            {saving
              ? "Bezig met indienen…"
              : isBewerken
              ? "Opnieuw indienen"
              : "Week indienen"}
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
  const [startDatum, setStartDatum] = useState(null);

  // null = nieuwe week invullen, week-object = bestaande week bewerken
  const [editWeek, setEditWeek] = useState(null);
  const [logbook, setLogbook] = useState(defaultLogbook(1));

  /* Weken ophalen van backend */
  async function fetchWeken(currentWeekNummer) {
    try {
      const res = await apiRequest("GET", `/logbooks/${user.id}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setWeken(data);

      if (data.length > 0 && !editWeek) {
        const maxWeek = Math.max(...data.map((w) => w.week_nummer));
        const alIngediend = data.some(
          (w) => w.week_nummer === (currentWeekNummer ?? 1)
        );
        if (alIngediend) {
          setLogbook(defaultLogbook(maxWeek + 1));
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
    fetchWeken(1);
    apiRequest("GET", "/internships/my")
      .then((res) => {
        if (res.data) {
          setStartDatum(new Date(res.data.startdatum ?? res.data.startDatum));
        }
      })
      .catch(() => {});
  }, [user.id]);

  /* Beschikbaarheidslogica */
  const vandaag = new Date();
  const verschilDagen = startDatum
    ? Math.floor((vandaag - startDatum) / (1000 * 60 * 60 * 24))
    : 0;
  const beschikbareWeek = Math.max(1, Math.ceil((verschilDagen + 1) / 7));

  const huidigFormulierWeek = editWeek ? editWeek.week_nummer : logbook.weekNummer;
  const weekAlIngediend =
    !editWeek && weken.some((w) => w.week_nummer === huidigFormulierWeek);
  const vorigeWeekOk =
    huidigFormulierWeek === 1 ||
    weken.some((w) => w.week_nummer === huidigFormulierWeek - 1);
  const weekBeschikbaar =
    editWeek != null ||
    (!weekAlIngediend && huidigFormulierWeek <= beschikbareWeek && vorigeWeekOk);

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
      await apiRequest("POST", "/logbooks", {
        stagedossierId: logbook.stagedossierId,
        weekNummer: Number(logbook.weekNummer),
        weekStart: logbook.weekStart,
        weekEinde: logbook.weekEinde,
        dagen: logbook.dagen.map((dag) => ({
          datum: dag.datum,
          titel: dag.titel,
          uitgevoerdeTaken: dag.uitgevoerdeTaken,
          reflectie: dag.reflectie,
          problemen: dag.problemen,
          aantalUren: Number(dag.aantalUren) || 0,
          status: "ingediend",
        })),
      });

      setEditWeek(null);
      await fetchWeken(logbook.weekNummer);
      setSubmitted(true);
    } catch (err) {
      const backendMsg = err.response?.data?.message;
      if (backendMsg?.toLowerCase().includes("stagedossier")) {
        setError("Je hebt nog geen actief stagedossier. Neem contact op met je stagebegeleider.");
      } else if (backendMsg?.includes("afgesloten")) {
        setError("Deze week is afgesloten en kan niet meer aangepast worden.");
      } else {
        setError(backendMsg || "Week indienen mislukt. Controleer je gegevens en probeer opnieuw.");
      }
      console.error(err);
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
    setLogbook(defaultLogbook(maxWeek + 1));
  }

  /* Nieuwe week starten */
  function handleNieuweWeek() {
    setSubmitted(false);
    setEditWeek(null);
    setError(null);
    const maxWeek =
      weken.length > 0 ? Math.max(...weken.map((w) => w.week_nummer)) : 0;
    setLogbook(defaultLogbook(maxWeek + 1));
  }

  /* ---------- Render ---------- */
  if (loadingWeken) {
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
                onVernieuwen={() => fetchWeken()}
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
                  : `Week ${logbook.weekNummer - 1} moet eerst ingediend worden.`}
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
            />
          )}
        </>
      )}
    </div>
  );
}
