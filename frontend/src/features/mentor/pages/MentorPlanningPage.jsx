import { useEffect, useState } from "react";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import "./MentorPlanningPage.css";
import { cacheGet, cacheSet, cacheDelete } from "../mentorCache";

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleDateString("nl-BE", {
    day: "2-digit", month: "long", year: "numeric",
  }) + " · " + d.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
}

function getBezoekStatusClass(status) {
  if (status === "bevestigd") return "s_ok";
  if (status === "alternatief_gevraagd") return "s_amber";
  if (status === "gegeven") return "s_ok";
  if (status === "geannuleerd") return "s_rood";
  return "s_info";
}

function getBezoekStatusLabel(status) {
  if (status === "voorgesteld") return "Te bevestigen";
  if (status === "gepland") return "Gepland";
  if (status === "bevestigd") return "Bevestigd door jou";
  if (status === "alternatief_gevraagd") return "Nieuw moment gevraagd";
  if (status === "gegeven") return "Heeft plaatsgevonden";
  if (status === "geannuleerd") return "Geannuleerd";
  return status || "-";
}

function getTypeLabel(type) {
  if (type === "bedrijfsbezoek") return "Bedrijfsbezoek";
  if (type === "tussentijdse_bespreking") return "Tussentijdse bespreking";
  if (type === "eindpresentatie") return "Eindpresentatie";
  return type || "Afspraak";
}

export default function MentorPlanningPage() {
  const { user } = useAuth();

  const [studenten, setStudenten] = useState([]);
  const [geselecteerdDossier, setGeselecteerdDossier] = useState(null);
  const [momenten, setMomenten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [planningLoading, setPlanningLoading] = useState(false);

  const [bezig, setBezig] = useState(null); // momentId dat actief is
  const [alternatifOpen, setAlternatifOpen] = useState(null); // momentId waarvan modal open is
  const [alternatifTekst, setAlternatifTekst] = useState("");
  const [melding, setMelding] = useState({ id: null, tekst: "", type: "" });

  useEffect(() => {
    async function loadStudenten() {
      const cached = cacheGet("mentor_students");
      if (cached) {
        setStudenten(cached);
        if (cached.length > 0) setGeselecteerdDossier(cached[0].dossier_id);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await api.get("/mentor/students");
        const data = res.data.data || [];
        cacheSet("mentor_students", data);
        setStudenten(data);
        if (data.length > 0) setGeselecteerdDossier(data[0].dossier_id);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadStudenten();
  }, []);

  useEffect(() => {
    if (!geselecteerdDossier) return;
    loadPlanning(geselecteerdDossier);
  }, [geselecteerdDossier]);

  async function loadPlanning(dossierId, forceRefresh = false) {
    if (!forceRefresh) {
      const cached = cacheGet(`mentor_planning_${dossierId}`);
      if (cached) { setMomenten(cached); setPlanningLoading(false); return; }
    }
    try {
      setPlanningLoading(true);
      setMomenten([]);
      setMelding({ id: null, tekst: "", type: "" });
      const res = await api.get(`/mentor/planning/${dossierId}`);
      const data = res.data.data || [];
      cacheSet(`mentor_planning_${dossierId}`, data);
      setMomenten(data);
    } catch {
      setMomenten([]);
    } finally {
      setPlanningLoading(false);
    }
  }

  async function handleBevestig(momentId) {
    try {
      setBezig(momentId);
      setMelding({ id: null, tekst: "", type: "" });
      await api.patch(`/mentor/planning/${momentId}/bevestig`, {});
      setMelding({ id: momentId, tekst: "Bedrijfsbezoek bevestigd! De docent en student kregen een melding.", type: "s_ok" });
      cacheDelete(`mentor_planning_${geselecteerdDossier}`);
      await loadPlanning(geselecteerdDossier, true);
    } catch (err) {
      setMelding({ id: momentId, tekst: err.response?.data?.message || "Bevestigen mislukt.", type: "s_rood" });
    } finally {
      setBezig(null);
    }
  }

  async function handleAlternatief(momentId) {
    if (!alternatifTekst.trim()) return;
    try {
      setBezig(momentId);
      setMelding({ id: null, tekst: "", type: "" });
      await api.patch(`/mentor/planning/${momentId}/alternatief`, { bericht: alternatifTekst });
      setMelding({ id: momentId, tekst: "Alternatief voorstel verstuurd. De docent plant het bezoek opnieuw in.", type: "s_ok" });
      setAlternatifOpen(null);
      setAlternatifTekst("");
      cacheDelete(`mentor_planning_${geselecteerdDossier}`);
      await loadPlanning(geselecteerdDossier, true);
    } catch (err) {
      setMelding({ id: momentId, tekst: err.response?.data?.message || "Versturen mislukt.", type: "s_rood" });
    } finally {
      setBezig(null);
    }
  }

  const geselecteerdeStudent = studenten.find((s) => s.dossier_id === geselecteerdDossier);

  return (
    <div className="page_inner">
      <div className="page_header">
        <div>
          <h1>Planning</h1>
          <p>Bekijk geplande bezoeken en bevestig of stel een alternatief voor.</p>
        </div>
      </div>

      {/* Student selector */}
      {!loading && studenten.length > 0 && (
        <div className="card" style={{ marginBottom: "12px" }}>
          <div className="card_title">Stagiair kiezen</div>
          <div className="form_group" style={{ marginBottom: 0 }}>
            <label className="form_label">Stagiair</label>
            <select
              className="form_input"
              value={geselecteerdDossier || ""}
              onChange={(e) => setGeselecteerdDossier(Number(e.target.value))}
            >
              {studenten.map((s) => (
                <option key={s.dossier_id} value={s.dossier_id}>
                  {s.voornaam} {s.achternaam} — {s.bedrijf}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {loading && <div className="card"><p className="muted">Laden...</p></div>}

      {!loading && studenten.length === 0 && (
        <div className="empty_state">Geen gekoppelde stagiairs gevonden.</div>
      )}

      {planningLoading && <div className="card"><p className="muted">Planning laden...</p></div>}

      {!planningLoading && !loading && momenten.length === 0 && geselecteerdDossier && (
        <div className="empty_state">
          Geen geplande afspraken voor{" "}
          {geselecteerdeStudent ? `${geselecteerdeStudent.voornaam} ${geselecteerdeStudent.achternaam}` : "deze stagiair"}.
        </div>
      )}

      {!planningLoading && momenten.map((moment) => {
        const teBevestigen = ["voorgesteld", "gepland"].includes(moment.status);
        const isAlternatifOpen = alternatifOpen === moment.id;

        return (
          <div
            key={moment.id}
            className="card"
            style={{
              marginBottom: "12px",
              borderColor: teBevestigen ? "var(--red)" : undefined,
            }}
          >
            <div className="card_title">
              <i className="ti ti-calendar" style={{ color: "var(--red)" }} />
              {" "}{getTypeLabel(moment.type)}{" "}
              <span className={`status ${getBezoekStatusClass(moment.status)}`}>
                {getBezoekStatusLabel(moment.status)}
              </span>
            </div>

            <div className="kv">
              <span className="k">Datum & tijdstip</span>
              <span className="v">{formatDateTime(moment.gepland_op)}</span>
            </div>

            {moment.locatie && (
              <div className="kv">
                <span className="k">Locatie</span>
                <span className="v">{moment.locatie}</span>
              </div>
            )}

            {moment.voorgesteld_door_naam && (
              <div className="kv">
                <span className="k">Voorgesteld door</span>
                <span className="v">{moment.voorgesteld_door_naam}</span>
              </div>
            )}

            {moment.alternatief_voorstel && (
              <div className="kv">
                <span className="k">Jouw voorstel</span>
                <span className="v" style={{ fontStyle: "italic" }}>"{moment.alternatief_voorstel}"</span>
              </div>
            )}

            {melding.id === moment.id && melding.tekst && (
              <div style={{ marginTop: "10px" }}>
                <span className={`status ${melding.type}`}>{melding.tekst}</span>
              </div>
            )}

            {teBevestigen && !isAlternatifOpen && (
              <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--sub)" }}>
                {moment.voorgesteld_door_naam
                  ? `${moment.voorgesteld_door_naam} stelt dit bezoek voor. Bevestig of stel een ander moment voor.`
                  : "Bevestig het bezoek of stel een ander moment voor."}
              </div>
            )}

            {teBevestigen && (
              <div className="actions" style={{ marginTop: "12px" }}>
                {!isAlternatifOpen ? (
                  <>
                    <button
                      className="btn primary"
                      disabled={bezig === moment.id}
                      onClick={() => handleBevestig(moment.id)}
                    >
                      <i className="ti ti-check" /> {bezig === moment.id ? "Bezig..." : "Bevestigen"}
                    </button>
                    <button
                      className="btn"
                      disabled={bezig === moment.id}
                      onClick={() => { setAlternatifOpen(moment.id); setAlternatifTekst(""); }}
                    >
                      <i className="ti ti-calendar-x" /> Ander moment voorstellen
                    </button>
                  </>
                ) : (
                  <div style={{ width: "100%" }}>
                    <div className="form_group">
                      <label className="form_label">Jouw voorstel</label>
                      <textarea
                        className="form_textarea"
                        placeholder="Geef een alternatief moment of reden op..."
                        value={alternatifTekst}
                        onChange={(e) => setAlternatifTekst(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="actions">
                      <button
                        className="btn primary"
                        disabled={bezig === moment.id || !alternatifTekst.trim()}
                        onClick={() => handleAlternatief(moment.id)}
                      >
                        {bezig === moment.id ? "Versturen..." : "Versturen"}
                      </button>
                      <button className="btn" onClick={() => setAlternatifOpen(null)}>
                        Annuleren
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
