import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../../services/api";
import "./StageApplicationPage.css";
import {
  IconBuilding, IconUserCheck, IconClipboardText, IconCalendar,
  IconCircleCheck, IconArrowRight, IconDeviceFloppy, IconSend,
  IconChecklist, IconInfoCircle,
} from "@tabler/icons-react";

export default function StageApplicationPage() {
  const navigate = useNavigate();
  const [error, setError]       = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [conceptOpgeslagen, setConceptOpgeslagen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [heeftConcept, setHeeftConcept] = useState(false);
  const [huidigStatus, setHuidigStatus] = useState(null);

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

  // Laad bestaand concept of aanpassingen-voorstel bij openen
  useEffect(() => {
    async function laadBestaand() {
      try {
        const res = await apiRequest("GET", "/internships/my");
        const data = res.data;
        if (!data) return;

        const laadbaar = ["concept", "aanpassingen_gevraagd"];
        if (!laadbaar.includes(data.status)) return;

        if (data.status === "concept") setHeeftConcept(true);
        setHuidigStatus(data.status);

        setForm({
          bedrijfNaam:           data.bedrijf_naam        || "",
          bedrijfAdres:          data.bedrijfsadres       || "",
          mentorNaam:            data.mentor_naam         || "",
          mentorEmail:           data.mentor_email        || "",
          mentorFunctie:         data.mentor_functie      || "",
          startDatum:            data.startdatum ? data.startdatum.slice(0, 10) : "",
          eindDatum:             data.einddatum  ? data.einddatum.slice(0, 10)  : "",
          opdrachtTitel:         data.stagefunctie        || "",
          opdrachtOmschrijving:  data.opdrachtomschrijving || "",
        });
      } catch {
        // geen voorstel gevonden — lege form is ok
      }
    }
    laadBestaand();
  }, []);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setConceptOpgeslagen(false);
  }

  async function handleSaveDraft(e) {
    e.preventDefault();
    setSavingDraft(true);
    setError(null);
    setConceptOpgeslagen(false);
    try {
      await apiRequest("POST", "/internships/draft", {
        bedrijfNaam:          form.bedrijfNaam,
        bedrijfsadres:        form.bedrijfAdres,
        mentorNaam:           form.mentorNaam,
        mentorEmail:          form.mentorEmail,
        mentorFunctie:        form.mentorFunctie,
        stagefunctie:         form.opdrachtTitel,
        opdrachtomschrijving: form.opdrachtOmschrijving,
        startdatum:           form.startDatum,
        einddatum:            form.eindDatum,
        urenPerWeek:          38,
      });
      setConceptOpgeslagen(true);
      setHeeftConcept(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Concept opslaan mislukt");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const payload = {
      bedrijfNaam:          form.bedrijfNaam,
      bedrijfsadres:        form.bedrijfAdres,
      mentorNaam:           form.mentorNaam,
      mentorEmail:          form.mentorEmail,
      mentorFunctie:        form.mentorFunctie,
      stagefunctie:         form.opdrachtTitel,
      opdrachtomschrijving: form.opdrachtOmschrijving,
      startdatum:           form.startDatum,
      einddatum:            form.eindDatum,
      urenPerWeek:          38,
    };
    // Bij aanpassingen_gevraagd → nieuwe versie aanmaken via herindienen
    const endpoint = huidigStatus === "aanpassingen_gevraagd"
      ? "/internships/my/herindienen"
      : "/internships";
    try {
      await apiRequest("POST", endpoint, payload);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Stagevoorstel indienen mislukt");
    }
  }

  if (submitted) {
    return (
      <div className="page-inner">
        <div className="page-header">
          <h1>Stagevoorstel</h1>
        </div>
        <div className="card succes-card">
          <div className="card_title">
            <IconCircleCheck size={16} />
            Stagevoorstel ingediend
          </div>
          <p>Je stagevoorstel is klaar voor verwerking. Je krijgt een melding na de beoordeling.</p>
          <div className="actions">
            <button className="btn primary" onClick={() => navigate("/student/internship", { state: { ingediend: true } })}>
              <IconArrowRight size={16} />
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
        <p>Vul alles in — je kan tussentijds opslaan als concept</p>
      </div>

      {heeftConcept && !conceptOpgeslagen && (
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card_title" style={{ color: "var(--blue)" }}>
            <IconInfoCircle size={16} />
            Concept geladen
          </div>
          <p style={{ fontSize: 13, color: "var(--sub)" }}>
            Je eerder opgeslagen concept is ingevuld. Pas aan en dien in wanneer klaar.
          </p>
        </div>
      )}

      {conceptOpgeslagen && (
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card_title" style={{ color: "var(--green)" }}>
            <IconCircleCheck size={16} />
            Concept opgeslagen
          </div>
          <p style={{ fontSize: 13, color: "var(--sub)" }}>
            Je gegevens zijn bewaard. Je kan later verder werken.
          </p>
        </div>
      )}

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
              <IconBuilding size={16} />
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
              <IconUserCheck size={16} />
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

          {/* Opdracht */}
          <div className="card">
            <div className="card_title">
              <IconClipboardText size={16} />
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
              <IconCalendar size={16} />
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
            <p className="stagevenster-info">Moet binnen het stagevenster van de opleiding vallen: 9 feb - 26 jun 2026.</p>
          </div>

          <div className="actions">
            <button type="button" className="btn" onClick={handleSaveDraft} disabled={savingDraft}>
              <IconDeviceFloppy size={16} />
              {savingDraft ? "Opslaan..." : "Opslaan als concept"}
            </button>
            <button type="submit" className="btn primary">
              <IconSend size={16} />
              Indienen
            </button>
          </div>

        </form>

        {/* Checklist sticky */}
        <div className="card checklist-sticky">
          <div className="card_title">
            <IconChecklist size={16} />
            Waar de commissie op let
          </div>
          <div className="checklist-item">
            <IconCircleCheck size={14} />
            Minstens 12 weken voltijds (456 uur) binnen het stagevenster
          </div>
          <div className="checklist-item">
            <IconCircleCheck size={14} />
            IT-gerelateerde opdracht met een ontwikkelcomponent
          </div>
          <div className="checklist-item">
            <IconCircleCheck size={14} />
            Mentor met een technische functie binnen het bedrijf
          </div>
          <div className="checklist-item">
            <IconCircleCheck size={14} />
            Concrete omschrijving: technologie, taken en team
          </div>
          <div className="checklist-item">
            <IconCircleCheck size={14} />
            Stage in een professionele bedrijfsomgeving
          </div>
        </div>

      </div>

    </div>
  );
}
