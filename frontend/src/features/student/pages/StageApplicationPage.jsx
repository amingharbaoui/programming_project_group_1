import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../../services/api";

export default function StageApplicationPage() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    bedrijfNaam: "",
    bedrijfsafdeling: "",
    bedrijfsadres: "",
    mentorNaam: "",
    mentorFunctie: "",
    mentorEmail: "",
    mentorTelefoon: "",
    stagefunctie: "",
    urenPerWeek: "",
    opdrachtomschrijving: "",
    startdatum: "",
    einddatum: "",
  });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest("POST", "/internships", form);
      navigate("/student/internship", { state: { ingediend: true } });
    } catch (err) {
      setError(err.response?.data?.message || "Er is iets misgegaan");
    }
  }

  return (
    <div className="page-inner">

      <div className="page-header">
        <h1>Stagevoorstel</h1>
        <p>Vul alles in — je kan tussentijds opslaan als concept</p>
      </div>

      {error && (
        <div className="card">
          <p className="status s_rood">{error}</p>
        </div>
      )}

      <div className="grid_2">

        <form onSubmit={handleSubmit}>

          <div className="card">
            <div className="card_title">
              <i className="ti ti-building" />
              Bedrijf
            </div>
            <div className="form_row">
              <div className="form_group">
                <label className="form_label">Bedrijfsnaam<span className="req">*</span></label>
                <input className="form_input" type="text" name="bedrijfNaam" value={form.bedrijfNaam} onChange={handleChange} placeholder="Naam van het bedrijf" />
              </div>
              <div className="form_group">
                <label className="form_label">Afdeling</label>
                <input className="form_input" type="text" name="bedrijfsafdeling" value={form.bedrijfsafdeling} onChange={handleChange} placeholder="Afdeling of team" />
              </div>
            </div>
            <div className="form_group">
              <label className="form_label">Adres<span className="req">*</span></label>
              <input className="form_input" type="text" name="bedrijfsadres" value={form.bedrijfsadres} onChange={handleChange} placeholder="Straat nr, postcode gemeente" />
            </div>
          </div>

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
            <div className="form_row">
              <div className="form_group">
                <label className="form_label">E-mail<span className="req">*</span></label>
                <input className="form_input" type="email" name="mentorEmail" value={form.mentorEmail} onChange={handleChange} />
              </div>
              <div className="form_group">
                <label className="form_label">Telefoon</label>
                <input className="form_input" type="tel" name="mentorTelefoon" value={form.mentorTelefoon} onChange={handleChange} placeholder="+32 470 00 00 00" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card_title">
              <i className="ti ti-clipboard-text" />
              Opdracht
            </div>
            <div className="form_row">
              <div className="form_group">
                <label className="form_label">Functie<span className="req">*</span></label>
                <input className="form_input" type="text" name="stagefunctie" value={form.stagefunctie} onChange={handleChange} placeholder="bv. Webdeveloper" />
              </div>
              <div className="form_group">
                <label className="form_label">Uren per week<span className="req">*</span></label>
                <input className="form_input" type="number" name="urenPerWeek" value={form.urenPerWeek} onChange={handleChange} placeholder="38" />
              </div>
            </div>
            <div className="form_group">
              <label className="form_label">Omschrijving van de opdracht<span className="req">*</span></label>
              <textarea className="form_textarea" name="opdrachtomschrijving" value={form.opdrachtomschrijving} onChange={handleChange} placeholder="Technologie, taken, team..." />
            </div>
          </div>

          <div className="card">
            <div className="card_title">
              <i className="ti ti-calendar" />
              Periode
            </div>
            <div className="form_row">
              <div className="form_group">
                <label className="form_label">Startdatum<span className="req">*</span></label>
                <input className="form_input" type="date" name="startdatum" value={form.startdatum} onChange={handleChange} />
              </div>
              <div className="form_group">
                <label className="form_label">Einddatum<span className="req">*</span></label>
                <input className="form_input" type="date" name="einddatum" value={form.einddatum} onChange={handleChange} />
              </div>
            </div>
            <p>Moet binnen het stagevenster van de opleiding vallen: 9 feb – 26 jun 2026.</p>
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