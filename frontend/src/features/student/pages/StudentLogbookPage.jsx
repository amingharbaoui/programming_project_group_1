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


    </div>
  );
}