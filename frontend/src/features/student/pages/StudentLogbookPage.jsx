import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../../services/api";

export default function StudentLogbookPage() {
  const navigate = useNavigate();
  const [weken, setWeken] = useState([]);
  const [error, setError] = useState(null);
  const [succes, setSucces] = useState(false);

  // Formulier state voor een nieuwe logboekweek
  const [form, setForm] = useState({
    weekNummer: "",
    taken: "",
    reflectie: "",
    leerpunten: "",
    aantalUren: "",
  });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  // Haal bestaande logboekweken op bij het laden
  useEffect(() => {
    async function fetchLogboek() {
      try {
        const data = await apiRequest("GET", "/logbooks/1");
        if (data.data) {
          setWeken(data.data);
        }
      } catch (err) {
        console.error("Kan logboek niet ophalen:", err);
      }
    }
    fetchLogboek();
  }, []);

  // Stuur nieuwe week in naar de backend
  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSucces(false);

    try {
      await apiRequest("POST", "/logbooks", {
        studentId: 1,
        weekNummer: Number(form.weekNummer),
        taken: form.taken,
        reflectie: form.reflectie,
        leerpunten: form.leerpunten,
        aantalUren: Number(form.aantalUren),
      });

      setSucces(true);

      // Reset formulier na indienen
      setForm({
        weekNummer: "",
        taken: "",
        reflectie: "",
        leerpunten: "",
        aantalUren: "",
      });

      // Herlaad de weken
      const data = await apiRequest("GET", "/logbooks/1");
      if (data.data) setWeken(data.data);

    } catch (err) {
      setError(err.response?.data?.message || "Er is iets misgegaan");
    }
  }

  return (
    <div className="page-inner">

      <div className="page-header">
        <h1>Logboek</h1>
        <p>Vul wekelijks je activiteiten in</p>
      </div>

      {/* Fout- en succesbericht */}
      {error && (
        <div className="card">
          <p className="status s_rood">{error}</p>
        </div>
      )}
      {succes && (
        <div className="card">
          <p className="status s_ok">Week succesvol ingediend.</p>
        </div>
      )}

      {/* Formulier voor nieuwe week */}
      <div className="card">
        <div className="card_title">
          <i className="ti ti-pencil" />
          Nieuwe week invullen
        </div>

        <form onSubmit={handleSubmit}>

          <div className="form_row">
            <div className="form_group">
              <label className="form_label">Weeknummer<span className="req">*</span></label>
              <input className="form_input" type="number" name="weekNummer" value={form.weekNummer} onChange={handleChange} placeholder="1" />
            </div>
            <div className="form_group">
              <label className="form_label">Aantal uren<span className="req">*</span></label>
              <input className="form_input" type="number" name="aantalUren" value={form.aantalUren} onChange={handleChange} placeholder="38" />
            </div>
          </div>

          <div className="form_group">
            <label className="form_label">Taken<span className="req">*</span></label>
            <textarea className="form_textarea" name="taken" value={form.taken} onChange={handleChange} placeholder="Wat heb je deze week gedaan?" />
          </div>

          <div className="form_group">
            <label className="form_label">Reflectie<span className="req">*</span></label>
            <textarea className="form_textarea" name="reflectie" value={form.reflectie} onChange={handleChange} placeholder="Hoe verliep de week?" />
          </div>

          <div className="form_group">
            <label className="form_label">Problemen / leerpunten</label>
            <textarea className="form_textarea" name="leerpunten" value={form.leerpunten} onChange={handleChange} placeholder="Wat liep moeilijk? Wat heb je geleerd?" />
          </div>

          <div className="actions">
            <button type="submit" className="btn primary">
              <i className="ti ti-send" />
              Week indienen
            </button>
          </div>

        </form>
      </div>

      

    </div>
  );
}