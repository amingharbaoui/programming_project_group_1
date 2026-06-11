import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../../services/api";

export default function StageApplicationPage() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  // Nieuwe state: submitted voor successmelding, gewijzigd: state namen aangepast aan spec
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    bedrijfNaam: "",
    bedrijfAdres: "",       
    mentorNaam: "",
    mentorEmail: "",
    mentorFunctie: "",
    startDatum: "",         
    eindDatum: "",          
    opdrachtTitel: "",      
    opdrachtOmschrijving: "", 
  });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  // aanvraag indienen
  async function handleSubmit(e) {
    e.preventDefault();

    const payload = {
      bedrijfNaam: form.bedrijfNaam,
      bedrijfsadres: form.bedrijfAdres,
      mentorNaam: form.mentorNaam,
      mentorEmail: form.mentorEmail,
      mentorFunctie: form.mentorFunctie,
      stagefunctie: form.opdrachtTitel,
      opdrachtomschrijving: form.opdrachtOmschrijving,
      startdatum: form.startDatum,
      einddatum: form.eindDatum,
      urenPerWeek: 38,
    };

    try {
      setError(null);
      await apiRequest("POST", "/internships", payload);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Stagevoorstel indienen mislukt");
    }
  }
  // Toon successmelding na indienen
  if (submitted) {
    return (
      <div className="page-inner">
        <div className="page-header">
          <h1>Stagevoorstel</h1>
        </div>
        <div className="card">
          <div className="card_title">
            <i className="ti ti-circle-check" />
            Stagevoorstel ingediend
          </div>
          <p>Je stagevoorstel is klaar voor verwerking. Je krijgt een melding na de beoordeling.</p>
          <div className="actions">
            <button className="btn primary" onClick={() => navigate("/student/internship")}>
              <i className="ti ti-arrow-right" />
              Naar mijn stage
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-inner">

      <div className="page-header">
        <h1>Stagevoorstel</h1>
        <p>Vul alles in Ã¢â‚¬â€ je kan tussentijds opslaan als concept</p>
      </div>

      {error && (
        <div className="card">
          <p className="status s_rood">{error}</p>
        </div>
      )}

      <div className="grid_2">

        <form onSubmit={handleSubmit}>

          {/* Bedrijfsgegevens */}
          <div className="card">
            <div className="card_title">
              <i className="ti ti-building" />
              Bedrijf
            </div>
            <div className="form_group">
              <label className="form_label">Bedrijfsnaam<span className="req">*</span></label>
              <input className="form_input" type="text" name="bedrijfNaam" value={form.bedrijfNaam} onChange={handleChange} placeholder="Naam van het bedrijf" />
            </div>
            <div className="form_group">
              <label className="form_label">Adres<span className="req">*</span></label>
              <input className="form_input" type="text" name="bedrijfAdres" value={form.bedrijfAdres} onChange={handleChange} placeholder="Straat nr, postcode gemeente" />
            </div>
          </div>

          {/* Mentorgegevens */}
          <div className="card">
            <div className="card_title">
              <i className="ti ti-user-check" />
              Mentor
            </div>
            <div className="form_row">
              <div className="form_group">
                <label className="form_label">Naam<span className="req">*</span></label>
                <input className="form_input" type="text" name="mentorNaam" value={form.mentorNaam} onChange={handleChange} placeholder="Naam van je mentor" />
              </div>
              <div className="form_group">
                <label className="form_label">Functie<span className="req">*</span></label>
                <input className="form_input" type="text" name="mentorFunctie" value={form.mentorFunctie} onChange={handleChange} placeholder="Functie" />
              </div>
            </div>
            <div className="form_group">
              <label className="form_label">E-mail<span className="req">*</span></label>
              <input className="form_input" type="email" name="mentorEmail" value={form.mentorEmail} onChange={handleChange} />
            </div>
          </div>

          {/* Opdracht Ã¢â‚¬â€ nieuw: opdrachtTitel en technologieen toegevoegd */}
          <div className="card">
            <div className="card_title">
              <i className="ti ti-clipboard-text" />
              Opdracht
            </div>
            <div className="form_group">
              <label className="form_label">Titel van de opdracht<span className="req">*</span></label>
              <input className="form_input" type="text" name="opdrachtTitel" value={form.opdrachtTitel} onChange={handleChange} placeholder="bv. Webdeveloper" />
            </div>
            <div className="form_group">
              <label className="form_label">Omschrijving van de opdracht<span className="req">*</span></label>
              <textarea className="form_textarea" name="opdrachtOmschrijving" value={form.opdrachtOmschrijving} onChange={handleChange} placeholder="Technologie, taken, team..." />
            </div>
          </div>

          {/* Stageperiode */}
          <div className="card">
            <div className="card_title">
              <i className="ti ti-calendar" />
              Periode
            </div>
            <div className="form_row">
              <div className="form_group">
                <label className="form_label">Startdatum<span className="req">*</span></label>
                <input className="form_input" type="date" name="startDatum" value={form.startDatum} onChange={handleChange} />
              </div>
              <div className="form_group">
                <label className="form_label">Einddatum<span className="req">*</span></label>
                <input className="form_input" type="date" name="eindDatum" value={form.eindDatum} onChange={handleChange} />
              </div>
            </div>
            <p>Moet binnen het stagevenster van de opleiding vallen: 9 feb Ã¢â‚¬â€œ 26 jun 2026.</p>
          </div>

          <div className="actions">
            <button type="button" className="btn">
              <i className="ti ti-device-floppy" />
              Opslaan als concept
            </button>
            <button type="submit" className="btn primary">
              <i className="ti ti-send" />
              Indienen
            </button>
          </div>

        </form>

        <div className="card">
          <div className="card_title">
            <i className="ti ti-checklist" />
            Waar de commissie op let
          </div>
          <p><i className="ti ti-circle-check" /> Minstens 12 weken voltijds (456 uur) binnen het stagevenster</p>
          <p><i className="ti ti-circle-check" /> IT-gerelateerde opdracht met een ontwikkelcomponent</p>
          <p><i className="ti ti-circle-check" /> Mentor met een technische functie binnen het bedrijf</p>
          <p><i className="ti ti-circle-check" /> Concrete omschrijving: technologie, taken en team</p>
          <p><i className="ti ti-circle-check" /> Stage in een professionele bedrijfsomgeving</p>
        </div>

      </div>

    </div>
  );
}