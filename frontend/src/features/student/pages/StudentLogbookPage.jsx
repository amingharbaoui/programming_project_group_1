import { useState } from "react";
import {
  IconCalendar, IconSend, IconPlus, IconCircleCheck
} from "@tabler/icons-react";

export default function StudentLogbookPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  // State structuur met 5 dagen per week
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

  // Wijzig een veld van de week zelf
  function handleWeekChange(e) {
    setLogbook({ ...logbook, [e.target.name]: e.target.value });
  }

  // Wijzig een veld van een specifieke dag
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

  // Totaal uren automatisch berekend
  const totaalUren = logbook.dagen.reduce((sum, dag) => sum + (Number(dag.aantalUren) || 0), 0);

  // Submit logt data naar console — David koppelt later POST /api/logbooks
  function handleSubmit(e) {
    e.preventDefault();
    console.log("logboek klaar voor backend", logbook);
    setSubmitted(true);
  }

  // Successmelding na indienen
  if (submitted) {
    return (
      <div className="page-inner">
        <div className="page-header">
          <h1>Logboek</h1>
        </div>
        <div className="card">
          <div className="card_title">
            <IconCircleCheck size={16} />
            Week ingediend
          </div>
          <p>Week {logbook.weekNummer} is ingediend. Totaal: {totaalUren} uren.</p>
          <div className="actions">
            <button className="btn primary" onClick={() => setSubmitted(false)}>
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

      <form onSubmit={handleSubmit}>

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
              {/* Automatisch berekend */}
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

        {/* 5 dagen invullen */}
        {logbook.dagen.map((dag, index) => (
          <div className="card" key={index}>
            <div className="card_title">
              Dag {index + 1}
            </div>
            <div className="form_row">
              <div className="form_group">
                <label className="form_label">Datum</label>
                <input className="form_input" type="date" name="datum" value={dag.datum} onChange={(e) => handleDagChange(index, e)} />
              </div>
              <div className="form_group">
                <label className="form_label">Aantal uren</label>
                <input className="form_input" type="number" name="aantalUren" value={dag.aantalUren} onChange={(e) => handleDagChange(index, e)} placeholder="8" />
              </div>
            </div>
            <div className="form_group">
              <label className="form_label">Titel</label>
              <input className="form_input" type="text" name="titel" value={dag.titel} onChange={(e) => handleDagChange(index, e)} placeholder="Wat was het hoofdthema van de dag?" />
            </div>
            <div className="form_group">
              <label className="form_label">Uitgevoerde taken</label>
              <textarea className="form_textarea" name="uitgevoerdeTaken" value={dag.uitgevoerdeTaken} onChange={(e) => handleDagChange(index, e)} placeholder="Wat heb je gedaan?" />
            </div>
            <div className="form_group">
              <label className="form_label">Reflectie</label>
              <textarea className="form_textarea" name="reflectie" value={dag.reflectie} onChange={(e) => handleDagChange(index, e)} placeholder="Hoe verliep de dag?" />
            </div>
            <div className="form_group">
              <label className="form_label">Problemen / leerpunten</label>
              <textarea className="form_textarea" name="problemen" value={dag.problemen} onChange={(e) => handleDagChange(index, e)} placeholder="Wat liep moeilijk? Wat heb je geleerd?" />
            </div>
          </div>
        ))}

        <div className="actions">
          <button type="submit" className="btn primary">
            <IconSend size={16} />
            Logboek indienen
          </button>
        </div>

      </form>

    </div>
  );
}