import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function StageApplicationPage() {
  const navigate = useNavigate();
  function handleSubmit(e) {
    e.preventDefault();
    navigate("/student", { state: { ingediend: true } });
  }

  return (
    <div className="page-inner">

      <div className="page-header">
        <h1>Stagevoorstel</h1>
        <p>Vul alles in — je kan tussentijds opslaan als concept</p>
      </div>

      <div className="grid-2">

        <form onSubmit={handleSubmit}>

          <div className="card">
            <div className="card-title">
              <i className="ti ti-building" />
              Bedrijf
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Bedrijfsnaam<span className="req">*</span></label>
                <input className="form-input" type="text" placeholder="Naam van het bedrijf" required />
              </div>
              <div className="form-group">
                <label className="form-label">Afdeling</label>
                <input className="form-input" type="text" placeholder="Afdeling of team" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Adres<span className="req">*</span></label>
              <input className="form-input" type="text" placeholder="Straat nr, postcode gemeente" required />
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <i className="ti ti-user-check" />
              Mentor
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Naam<span className="req">*</span></label>
                <input className="form-input" type="text" placeholder="Naam van je mentor" required />
              </div>
              <div className="form-group">
                <label className="form-label">Functie<span className="req">*</span></label>
                <input className="form-input" type="text" placeholder="Functie" required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">E-mail<span className="req">*</span></label>
                <input className="form-input" type="email" required />
              </div>
              <div className="form-group">
                <label className="form-label">Telefoon</label>
                <input className="form-input" type="tel" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <i className="ti ti-clipboard-text" />
              Opdracht
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Functie<span className="req">*</span></label>
                <input className="form-input" type="text" placeholder="bv. Webdeveloper" required />
              </div>
              <div className="form-group">
                <label className="form-label">Uren per week<span className="req">*</span></label>
                <input className="form-input" type="number" placeholder="38" required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Omschrijving van de opdracht<span className="req">*</span></label>
              <textarea className="form-textarea" placeholder="Technologie, taken, team..." required />
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <i className="ti ti-calendar" />
              Periode
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Startdatum<span className="req">*</span></label>
                <input className="form-input" type="date" required />
              </div>
              <div className="form-group">
                <label className="form-label">Einddatum<span className="req">*</span></label>
                <input className="form-input" type="date" required />
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
          <div className="card-title">
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