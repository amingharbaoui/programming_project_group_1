import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { apiRequest } from "../../../services/api";
import {
  IconCalendar, IconSend, IconPlus, IconCircleCheck, IconChevronDown, IconChevronUp, IconLock
} from "@tabler/icons-react";

export default function StudentLogbookPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [ingediendeDagen, setIngediendeDagen] = useState([false, false, false, false, false]);
  const [openvouwDagen, setOpenvouwDagen] = useState([true, true, true, true, true]);
  const [weken, setWeken] = useState([]);
  const [startDatum, setStartDatum] = useState(null);

  const [logbook, setLogbook] = useState({
    stagedossierId: 1,
    weekNummer: 1,
    weekStart: "",
    weekEinde: "",
    dagen: [
      { datum: "", titel: "", uitgevoerdeTaken: "", reflectie: "", problemen: "", aantalUren: 0 },
      { datum: "", titel: "", uitgevoerdeTaken: "", reflectie: "", problemen: "", aantalUren: 0 },
      { datum: "", titel: "", uitgevoerdeTaken: "", reflectie: "", problemen: "", aantalUren: 0 },
      { datum: "", titel: "", uitgevoerdeTaken: "", reflectie: "", problemen: "", aantalUren: 0 },
      { datum: "", titel: "", uitgevoerdeTaken: "", reflectie: "", problemen: "", aantalUren: 0 },
    ],
  });

  // Startdatum ophalen van de eigen stage
  useEffect(() => {
    async function fetchStartDatum() {
      try {
        const res = await apiRequest("GET", "/internships/my");
        if (res.data) {
          setStartDatum(new Date(res.data.startdatum || res.data.startDatum));
        }
      } catch (err) {
        console.error("Kan startdatum niet ophalen:", err);
      }
    }
    fetchStartDatum();
  }, []);

  // Welke week is vandaag beschikbaar op basis van startdatum
  const vandaag = new Date();
  const verschilDagen = startDatum
    ? Math.floor((vandaag - startDatum) / (1000 * 60 * 60 * 24))
    : 0;
  const beschikbareWeek = Math.max(1, Math.ceil((verschilDagen + 1) / 7));

  // Week mag alleen ingevuld worden als vorige week ingediend is én week al gestart is
  const weekBeschikbaar =
    logbook.weekNummer <= beschikbareWeek &&
    (logbook.weekNummer === 1 || weken.some(w => w.weekNummer === logbook.weekNummer - 1));

  function handleWeekChange(e) {
    setLogbook({ ...logbook, [e.target.name]: e.target.value });
  }

  function handleDagChange(index, e) {
    const updatedDagen = [...logbook.dagen];
    updatedDagen[index] = {
      ...updatedDagen[index],
      [e.target.name]: e.target.name === "aantalUren"
        ? Number(e.target.value)
        : e.target.value,
    };
    setLogbook({ ...logbook, dagen: updatedDagen });
  }

  // Uren van alle dagen optellen
  const totaalUren = logbook.dagen.reduce((sum, dag) => sum + (Number(dag.aantalUren) || 0), 0);

  // Dag indienen en dichtklappen
  function handleDagIndienen(index) {
    const updatedIngediend = [...ingediendeDagen];
    updatedIngediend[index] = true;
    setIngediendeDagen(updatedIngediend);

    const updatedOpenvouw = [...openvouwDagen];
    updatedOpenvouw[index] = false;
    setOpenvouwDagen(updatedOpenvouw);
  }

  function toggleDag(index) {
    const updated = [...openvouwDagen];
    updated[index] = !updated[index];
    setOpenvouwDagen(updated);
  }

  const allesDagIngediend = ingediendeDagen.every(Boolean);

  // Week opslaan en volgende week klaarzetten
  function handleWeekIndienen(e) {
    e.preventDefault();
    console.log("logboek klaar voor backend", logbook);
    setWeken([...weken, { ...logbook, totaalUren }]);
    setSubmitted(true);
  }

  // Nieuwe week starten — weeknummer gaat automatisch omhoog
  function handleNieuweWeek() {
    setSubmitted(false);
    setIngediendeDagen([false, false, false, false, false]);
    setOpenvouwDagen([true, true, true, true, true]);
    setLogbook({
      stagedossierId: 1,
      weekNummer: logbook.weekNummer + 1,
      weekStart: "",
      weekEinde: "",
      dagen: [
        { datum: "", titel: "", uitgevoerdeTaken: "", reflectie: "", problemen: "", aantalUren: 0 },
        { datum: "", titel: "", uitgevoerdeTaken: "", reflectie: "", problemen: "", aantalUren: 0 },
        { datum: "", titel: "", uitgevoerdeTaken: "", reflectie: "", problemen: "", aantalUren: 0 },
        { datum: "", titel: "", uitgevoerdeTaken: "", reflectie: "", problemen: "", aantalUren: 0 },
        { datum: "", titel: "", uitgevoerdeTaken: "", reflectie: "", problemen: "", aantalUren: 0 },
      ],
    });
  }

  if (submitted) {
    return (
      <div className="page-inner">

        <div className="page-header">
          <h1>Logboek</h1>
          <p>Overzicht van ingediende weken</p>
        </div>

        {/* Alle ingediende weken tonen */}
        {weken.map((week, index) => (
          <div className="card" key={index}>
            <div className="card_title">
              <IconCircleCheck size={16} />
              Week {week.weekNummer}
            </div>
            <div className="kv"><span className="k">Start</span><span className="v">{week.weekStart || "—"}</span></div>
            <div className="kv"><span className="k">Einde</span><span className="v">{week.weekEinde || "—"}</span></div>
            <div className="kv"><span className="k">Totaal uren</span><span className="v">{week.totaalUren}u</span></div>
          </div>
        ))}

        <div className="card">
          <div className="actions">
            <button className="btn primary" onClick={handleNieuweWeek}>
              <IconPlus size={16} />
              Nieuwe week invullen
            </button>
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="page-inner">

      <div className="page-header">
        <h1>Logboek</h1>
        <p>Vul wekelijks je activiteiten in</p>
      </div>

      {error && (
        <div className="card">
          <p className="status s_rood">{error}</p>
        </div>
      )}

      {/* Week nog niet beschikbaar */}
      {!weekBeschikbaar && (
        <div className="card">
          <div className="card_title">
            <IconLock size={16} />
            Week {logbook.weekNummer} nog niet beschikbaar
          </div>
          <p>
            {logbook.weekNummer === 1
              ? "Je stage is nog niet gestart."
              : `Week ${logbook.weekNummer - 1} moet eerst ingediend worden.`}
          </p>
        </div>
      )}

      {/* Formulier alleen tonen als week beschikbaar is */}
      {weekBeschikbaar && (
        <form onSubmit={handleWeekIndienen}>

          {/* Week informatie */}
          <div className="card">
            <div className="card_title">
              <IconCalendar size={16} />
              Week informatie
            </div>
            <div className="form_row">
              <div className="form_group">
                <label className="form_label">Weeknummer<span className="req">*</span></label>
                <input className="form_input" type="number" name="weekNummer" value={logbook.weekNummer} onChange={handleWeekChange} placeholder="1" />
              </div>
              <div className="form_group">
                <label className="form_label">Totaal uren</label>
                <input className="form_input" type="number" value={totaalUren} readOnly />
              </div>
            </div>
            <div className="form_row">
              <div className="form_group">
                <label className="form_label">Week start<span className="req">*</span></label>
                <input className="form_input" type="date" name="weekStart" value={logbook.weekStart} onChange={handleWeekChange} />
              </div>
              <div className="form_group">
                <label className="form_label">Week einde<span className="req">*</span></label>
                <input className="form_input" type="date" name="weekEinde" value={logbook.weekEinde} onChange={handleWeekChange} />
              </div>
            </div>
          </div>

          {/* 5 dagen uitklapbaar */}
          {logbook.dagen.map((dag, index) => (
            <div className="card" key={index}>

              <div className="card_title" onClick={() => toggleDag(index)} style={{ cursor: "pointer" }}>
                Dag {index + 1}
                {ingediendeDagen[index] && (
                  <span className="status s_ok">
                    <IconCircleCheck size={14} />
                    Ingediend
                  </span>
                )}
                {openvouwDagen[index] ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
              </div>

              {openvouwDagen[index] && (
                <>
                  <div className="form_row">
                    <div className="form_group">
                      <label className="form_label">Datum</label>
                      <input className="form_input" type="date" name="datum" value={dag.datum} onChange={(e) => handleDagChange(index, e)} disabled={ingediendeDagen[index]} />
                    </div>
                    <div className="form_group">
                      <label className="form_label">Aantal uren</label>
                      <input className="form_input" type="number" name="aantalUren" value={dag.aantalUren} onChange={(e) => handleDagChange(index, e)} placeholder="8" disabled={ingediendeDagen[index]} />
                    </div>
                  </div>

                  <div className="form_group">
                    <label className="form_label">Titel</label>
                    <input className="form_input" type="text" name="titel" value={dag.titel} onChange={(e) => handleDagChange(index, e)} placeholder="Wat was het hoofdthema van de dag?" disabled={ingediendeDagen[index]} />
                  </div>

                  <div className="form_group">
                    <label className="form_label">Uitgevoerde taken</label>
                    <textarea className="form_textarea" name="uitgevoerdeTaken" value={dag.uitgevoerdeTaken} onChange={(e) => handleDagChange(index, e)} placeholder="Wat heb je gedaan?" disabled={ingediendeDagen[index]} />
                  </div>

                  <div className="form_group">
                    <label className="form_label">Reflectie</label>
                    <textarea className="form_textarea" name="reflectie" value={dag.reflectie} onChange={(e) => handleDagChange(index, e)} placeholder="Hoe verliep de dag?" disabled={ingediendeDagen[index]} />
                  </div>

                  <div className="form_group">
                    <label className="form_label">Problemen / leerpunten</label>
                    <textarea className="form_textarea" name="problemen" value={dag.problemen} onChange={(e) => handleDagChange(index, e)} placeholder="Wat liep moeilijk? Wat heb je geleerd?" disabled={ingediendeDagen[index]} />
                  </div>

                  {!ingediendeDagen[index] && (
                    <div className="actions">
                      <button type="button" className="btn primary" onClick={() => handleDagIndienen(index)}>
                        <IconSend size={16} />
                        Dag {index + 1} indienen
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {/* Week indienen pas zichtbaar als alle dagen ingediend zijn */}
          {allesDagIngediend && (
            <div className="actions">
              <button type="submit" className="btn primary">
                <IconSend size={16} />
                Week indienen
              </button>
            </div>
          )}

        </form>
      )}

    </div>
  );
}