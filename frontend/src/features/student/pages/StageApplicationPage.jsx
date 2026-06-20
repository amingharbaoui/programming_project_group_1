import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../../services/api";
import { cacheGet, cacheSet, cacheDelete } from "../studentCache";
import "./StageApplicationPage.css";
import Modal from "../../../components/ui/Modal";
import {
  IconBuilding, IconUserCheck, IconClipboardText, IconCalendar,
  IconCircleCheck, IconDeviceFloppy, IconSend,
  IconChecklist, IconInfoCircle,
} from "@tabler/icons-react";

export default function StageApplicationPage() {
  const navigate = useNavigate();
  const [error, setError]       = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [heeftConcept, setHeeftConcept] = useState(false);
  const [huidigStatus, setHuidigStatus] = useState(null);
  // Modal state: null = gesloten, object = { icon, titel, sub, body, onSluit }
  const [modal, setModal] = useState(null);
  const [stageRegel, setStageRegel] = useState(null);
  const [checklistItems, setChecklistItems] = useState([]);

  useEffect(() => {
    apiRequest("GET", "/internships/settings").then(res => {
      if (res?.data?.stageRegels?.[0]) setStageRegel(res.data.stageRegels[0]);
      if (res?.data?.checklistItems) setChecklistItems(res.data.checklistItems.filter(i => i.actief));
    }).catch(() => {});
  }, []);

  const [form, setForm] = useState({
    bedrijfNaam: "",
    bedrijfAfdeling: "",
    bedrijfAdres: "",
    mentorNaam: "",
    mentorEmail: "",
    mentorTelefoon: "",
    mentorFunctie: "",
    startDatum: "",
    eindDatum: "",
    urenPerWeek: 38,
    opdrachtTitel: "",
    opdrachtOmschrijving: "",
  });

  // Laad bestaand concept of aanpassingen-voorstel bij openen
  useEffect(() => {
    async function laadBestaand() {
      try {
        const cached = cacheGet("student_internship");
        const data = cached ?? (await apiRequest("GET", "/internships/my")).data;
        if (!data) return;

        const laadbaar = ["concept", "aanpassingen_gevraagd"];
        if (!laadbaar.includes(data.status)) return;

        setHuidigStatus(data.status);
        if (data.status === "concept") setHeeftConcept(true);

        setForm({
          bedrijfNaam:           data.bedrijf_naam        || "",
          bedrijfAfdeling:       data.bedrijfsafdeling    || "",
          bedrijfAdres:          data.bedrijfsadres       || "",
          mentorNaam:            data.mentor_naam         || "",
          mentorEmail:           data.mentor_email        || "",
          mentorTelefoon:        data.mentor_telefoon     || "",
          mentorFunctie:         data.mentor_functie      || "",
          startDatum:            data.startdatum ? data.startdatum.slice(0, 10) : "",
          eindDatum:             data.einddatum  ? data.einddatum.slice(0, 10)  : "",
          urenPerWeek:           data.uren_per_week       || 38,
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
  }

  async function handleSaveDraft(e) {
    e.preventDefault();
    setSavingDraft(true);
    setError(null);
    try {
      cacheDelete("student_internship");
      await apiRequest("POST", "/internships/draft", {
        bedrijfNaam:          form.bedrijfNaam,
        bedrijfsafdeling:     form.bedrijfAfdeling,
        bedrijfsadres:        form.bedrijfAdres,
        mentorNaam:           form.mentorNaam,
        mentorEmail:          form.mentorEmail,
        mentorTelefoon:       form.mentorTelefoon,
        mentorFunctie:        form.mentorFunctie,
        stagefunctie:         form.opdrachtTitel,
        opdrachtomschrijving: form.opdrachtOmschrijving,
        startdatum:           form.startDatum,
        einddatum:            form.eindDatum,
        urenPerWeek:          Number(form.urenPerWeek) || 38,
      });
      setHeeftConcept(true);
      setModal({
        icon:  "ti-device-floppy",
        titel: "Concept opgeslagen",
        sub:   "Je kan later verder werken.",
        body:  "Je gegevens zijn veilig bewaard. Kom terug wanneer je klaar bent om in te dienen.",
      });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Concept opslaan mislukt");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    // Client-side validatie van verplichte velden (backend blijft de bewaker).
    const verplicht = {
      Bedrijfsnaam: form.bedrijfNaam,
      Adres: form.bedrijfAdres,
      "Mentor naam": form.mentorNaam,
      "Mentor functie": form.mentorFunctie,
      "Mentor e-mail": form.mentorEmail,
      "Titel opdracht": form.opdrachtTitel,
      "Omschrijving opdracht": form.opdrachtOmschrijving,
      Startdatum: form.startDatum,
      Einddatum: form.eindDatum,
    };
    const ontbrekend = Object.entries(verplicht)
      .filter(([, v]) => !String(v || "").trim())
      .map(([k]) => k);
    if (ontbrekend.length > 0) {
      setError("Vul de verplichte velden in: " + ontbrekend.join(", ") + ".");
      return;
    }

    const isHerindienen = huidigStatus === "aanpassingen_gevraagd";
    const endpoint = isHerindienen ? "/internships/my/herindienen" : "/internships";
    try {
      cacheDelete("student_internship", "student_internship_historiek");
      await apiRequest("POST", endpoint, {
        bedrijfNaam:          form.bedrijfNaam,
        bedrijfsafdeling:     form.bedrijfAfdeling,
        bedrijfsadres:        form.bedrijfAdres,
        mentorNaam:           form.mentorNaam,
        mentorEmail:          form.mentorEmail,
        mentorTelefoon:       form.mentorTelefoon,
        mentorFunctie:        form.mentorFunctie,
        stagefunctie:         form.opdrachtTitel,
        opdrachtomschrijving: form.opdrachtOmschrijving,
        startdatum:           form.startDatum,
        einddatum:            form.eindDatum,
        urenPerWeek:          Number(form.urenPerWeek) || 38,
      });
      setSubmitted(true);
      setModal({
        icon:  "ti-send",
        titel: isHerindienen ? "Aangepast voorstel heringediend" : "Stagevoorstel ingediend",
        sub:   "Je krijgt een melding na de beoordeling.",
        body:  "Je stagevoorstel is klaar voor verwerking. De commissie bekijkt het voorstel en contacteert je zodra er een beslissing is.",
        navigeerNa: true,
      });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Stagevoorstel indienen mislukt");
    }
  }

  return (
    <>
    <div className="page-inner">

      <div className="page-header">
        <h1>Stagevoorstel</h1>
        <p>Vul alles in — je kan tussentijds opslaan als concept</p>
      </div>

      {heeftConcept && (
        <div className="card">
          <div className="card_title" style={{ color: "var(--blue)" }}>
            <IconInfoCircle size={16} style={{ color: "var(--blue)" }} />
            Concept geladen
          </div>
          <p style={{ fontSize: 13, color: "var(--sub)" }}>
            Je eerder opgeslagen concept is ingevuld. Pas aan en dien in wanneer klaar.
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
              <input className="form_input" type="text" name="bedrijfNaam" value={form.bedrijfNaam} onChange={handleChange} placeholder="Naam van het bedrijf" required />
            </div>
            <div className="form_group">
              <label className="form_label">Afdeling</label>
              <input className="form_input" type="text" name="bedrijfAfdeling" value={form.bedrijfAfdeling} onChange={handleChange} placeholder="bv. IT / Development" />
            </div>
            <div className="form_group">
              <label className="form_label">Adres<span className="req">*</span></label>
              <input className="form_input" type="text" name="bedrijfAdres" value={form.bedrijfAdres} onChange={handleChange} placeholder="Straat nr, postcode gemeente" required />
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
                <input className="form_input" type="text" name="mentorNaam" value={form.mentorNaam} onChange={handleChange} placeholder="Naam van je mentor" required />
              </div>
              <div className="form_group">
                <label className="form_label">Functie<span className="req">*</span></label>
                <input className="form_input" type="text" name="mentorFunctie" value={form.mentorFunctie} onChange={handleChange} placeholder="Functie" required />
              </div>
            </div>
            <div className="form_row">
              <div className="form_group">
                <label className="form_label">E-mail<span className="req">*</span></label>
                <input className="form_input" type="email" name="mentorEmail" value={form.mentorEmail} onChange={handleChange} required />
              </div>
              <div className="form_group">
                <label className="form_label">Telefoon</label>
                <input className="form_input" type="tel" name="mentorTelefoon" value={form.mentorTelefoon} onChange={handleChange} placeholder="bv. +32 ..." />
              </div>
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
              <input className="form_input" type="text" name="opdrachtTitel" value={form.opdrachtTitel} onChange={handleChange} placeholder="bv. Webdeveloper" required />
            </div>
            <div className="form_group">
              <label className="form_label">Omschrijving van de opdracht<span className="req">*</span></label>
              <textarea className="form_textarea" name="opdrachtOmschrijving" value={form.opdrachtOmschrijving} onChange={handleChange} placeholder="Technologie, taken, team..." required />
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
                <input className="form_input" type="date" name="startDatum" value={form.startDatum} onChange={handleChange} required />
              </div>
              <div className="form_group">
                <label className="form_label">Einddatum<span className="req">*</span></label>
                <input className="form_input" type="date" name="eindDatum" value={form.eindDatum} onChange={handleChange} required />
              </div>
            </div>
            <div className="form_group">
              <label className="form_label">Uren per week</label>
              <input className="form_input" type="number" min="1" max="60" name="urenPerWeek" value={form.urenPerWeek} onChange={handleChange} placeholder="38" />
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
            Minstens {stageRegel?.minimum_weken ?? 12} weken voltijds ({stageRegel?.minimum_uren ?? 456} uur) binnen het stagevenster
          </div>
          {checklistItems.map((item) => (
            <div className="checklist-item" key={item.id}>
              <IconCircleCheck size={14} />
              {item.tekst}
            </div>
          ))}
        </div>

      </div>

    </div>

    {/* Modal: concept opgeslagen / ingediend / heringediend */}
    {modal && (
      <Modal
        open={true}
        onClose={() => {
          if (modal.navigeerNa) navigate("/student/internship", { state: { ingediend: true } });
          setModal(null);
        }}
        icon={modal.icon}
        titel={modal.titel}
        sub={modal.sub}
        footer={
          <button
            className="btn primary"
            onClick={() => {
              if (modal.navigeerNa) navigate("/student/internship", { state: { ingediend: true } });
              setModal(null);
            }}
          >
            <i className="ti ti-check"></i> Begrepen
          </button>
        }
      >
        <p>{modal.body}</p>
      </Modal>
    )}
    </>
  );
}
