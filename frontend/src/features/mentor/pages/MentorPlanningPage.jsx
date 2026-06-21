import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import "./MentorPlanningPage.css";
import { cacheGet, cacheSet, cacheDelete } from "../mentorCache";
import { kiesMentorStagiair, onthoudMentorDossier } from "../mentorSelection";
import { planningStatusClass, planningStatusLabel } from "../../../utils/stageFlow";

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleDateString("nl-BE", {
    day: "2-digit", month: "long", year: "numeric",
  }) + " · " + d.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
}

function getBezoekStatusClass(status) {
  return planningStatusClass(status);
}

function getBezoekStatusLabel(status) {
  if (status === "bevestigd") return "Bevestigd door jou";
  if (status === "gegeven") return "Heeft plaatsgevonden";
  return planningStatusLabel({ status });
}

function getTypeLabel(type) {
  if (type === "bedrijfsbezoek") return "Bedrijfsbezoek";
  if (type === "tussentijdse_bespreking") return "Tussentijdse bespreking";
  if (type === "eindpresentatie") return "Eindpresentatie";
  return type || "Afspraak";
}

export default function MentorPlanningPage() {
  const { user } = useAuth();

  const [searchParams] = useSearchParams();
  const [studenten, setStudenten] = useState([]);
  const [geselecteerdDossier, setGeselecteerdDossier] = useState(null);
  const [momenten, setMomenten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [planningLoading, setPlanningLoading] = useState(false);
  const [laadFout, setLaadFout] = useState("");

  const [bezig, setBezig] = useState(null); // momentId dat actief is
  const [alternatifOpen, setAlternatifOpen] = useState(null); // momentId waarvan modal open is
  const [alternatifTekst, setAlternatifTekst] = useState("");
  const [altDatum, setAltDatum] = useState("");
  const [altUur, setAltUur] = useState("10:00");
  const [altPlaats, setAltPlaats] = useState("");
  const [melding, setMelding] = useState({ id: null, tekst: "", type: "" });
  const [voorstelPopupId, setVoorstelPopupId] = useState(null); // 522: auto-popup voor een nieuw voorstel
  const [gesloten, setGesloten] = useState(() => {
    try {
      return new Set(
        Object.keys(sessionStorage)
          .filter((k) => k.startsWith("flow_popup_seen_") && k.includes("_mentor_planning_"))
          .map((k) => Number(k.split("_mentor_planning_")[1]?.split("_")[0]))
          .filter(Boolean)
      );
    } catch {
      return new Set();
    }
  }); // per planning-id: popup bewust gesloten

  // 522: zodra de planning geladen is, automatisch de pop-up tonen voor het nieuwste nog te bevestigen
  // (voorgesteld/gepland) moment dat de mentor nog niet bewust sloot — net als het prototype.
  useEffect(() => {
    const teBevestigen = momenten.find(
      (m) => ["bedrijfsbezoek", "eindpresentatie"].includes(m.type)
        && ["voorgesteld", "gepland"].includes(m.status) && !gesloten.has(m.id)
    );
    setVoorstelPopupId(teBevestigen ? teBevestigen.id : null);
  }, [momenten, gesloten]);

  useEffect(() => {
    async function loadStudenten() {
      const cached = cacheGet("mentor_students");
      if (cached) {
        setStudenten(cached);
        if (cached.length > 0) setGeselecteerdDossier(kiesMentorStagiair(cached, searchParams)?.dossier_id);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setLaadFout("");
        const res = await api.get("/mentor/students");
        const data = res.data.data || [];
        cacheSet("mentor_students", data);
        setStudenten(data);
        if (data.length > 0) setGeselecteerdDossier(kiesMentorStagiair(data, searchParams)?.dossier_id);
      } catch (err) {
        // 513: een laadfout niet als "geen stagiairs" tonen, maar als echte fout met retry.
        setLaadFout(err.response?.data?.message || "Je stagiairs konden niet geladen worden. Probeer het opnieuw.");
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
      setLaadFout("");
      const res = await api.get(`/mentor/planning/${dossierId}`);
      const data = res.data.data || [];
      cacheSet(`mentor_planning_${dossierId}`, data);
      setMomenten(data);
    } catch (err) {
      setMomenten([]);
      setLaadFout(err.response?.data?.message || "De planning kon niet geladen worden. Probeer het opnieuw.");
    } finally {
      setPlanningLoading(false);
    }
  }

  async function handleBevestig(momentId) {
    try {
      setBezig(momentId);
      setMelding({ id: null, tekst: "", type: "" });
      await api.patch(`/mentor/planning/${momentId}/bevestig`, {});
      setMelding({ id: momentId, tekst: "Moment bevestigd! De docent en student kregen een melding.", type: "s_ok" });
      cacheDelete(`mentor_planning_${geselecteerdDossier}`);
      await loadPlanning(geselecteerdDossier, true);
    } catch (err) {
      setMelding({ id: momentId, tekst: err.response?.data?.message || "Bevestigen mislukt.", type: "s_rood" });
    } finally {
      setBezig(null);
    }
  }

  function sluitVoorstelPopup(id) {
    try {
      sessionStorage.setItem(`flow_popup_seen_${user.id}_mentor_planning_${id}_voorgesteld`, "1");
      sessionStorage.setItem(`flow_popup_seen_${user.id}_mentor_planning_${id}_gepland`, "1");
    } catch { /* ignore */ }
    setGesloten((prev) => new Set(prev).add(id));
    setVoorstelPopupId(null);
  }

  function openAlternatief(moment) {
    setVoorstelPopupId(null); // de auto-popup sluiten; we openen de alternatief-modal
    setAlternatifOpen(moment.id);
    setAlternatifTekst("");
    // Voorvullen met het huidige moment zodat de mentor enkel hoeft aan te passen.
    const d = moment.gepland_op ? new Date(moment.gepland_op) : null;
    setAltDatum(d ? d.toISOString().slice(0, 10) : "");
    setAltUur(d ? d.toTimeString().slice(0, 5) : "10:00");
    setAltPlaats(moment.locatie || "");
  }

  async function handleAlternatief(momentId) {
    if (!alternatifTekst.trim()) { setMelding({ id: momentId, tekst: "Geef een korte reden of toelichting.", type: "s_rood" }); return; }
    if (!altDatum) { setMelding({ id: momentId, tekst: "Kies een datum voor je voorstel.", type: "s_rood" }); return; }
    try {
      setBezig(momentId);
      setMelding({ id: null, tekst: "", type: "" });
      await api.patch(`/mentor/planning/${momentId}/alternatief`, {
        bericht: alternatifTekst,
        geplandOp: `${altDatum}T${altUur || "00:00"}`,
        locatie: altPlaats || null,
      });
      setMelding({ id: momentId, tekst: "Alternatief voorstel verstuurd. De docent bekijkt je voorstel.", type: "s_ok" });
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
  // In de eindfase is planning read-only; toon dan geen bevestig/alternatief-knoppen (auditpunt 421,
  // gelijk aan MentorDossierPage). De backend weigert die acties toch met 409.
  const dossierAfgerond = ["afgerond", "voltooid", "resultaat_vrijgegeven"].includes(geselecteerdeStudent?.dossier_status);

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1>Planning</h1>
        <p>Bekijk geplande bezoeken en bevestig of stel een alternatief voor</p>
      </div>

      {/* 522: automatische pop-up bij een nieuw voorgesteld moment, zoals het mentorprototype */}
      {(() => {
        const m = momenten.find((x) => x.id === voorstelPopupId);
        if (!m || alternatifOpen) return null;
        const isPres = m.type === "eindpresentatie";
        return (
          <div className="modal_overlay" onClick={() => sluitVoorstelPopup(m.id)}>
            <div className="modal_box" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal_header">
                <span className="modal_title">{isPres ? "Eindpresentatie voorgesteld" : "Bedrijfsbezoek voorgesteld"}</span>
                <button className="icon_btn" onClick={() => sluitVoorstelPopup(m.id)}><i className="ti ti-x" /></button>
              </div>
              <div className="modal_body">
                <p className="muted" style={{ marginTop: 0, fontSize: 12.5 }}>
                  {m.voorgesteld_door_naam ? `${m.voorgesteld_door_naam} (docent)` : "De docent"} · voor de {isPres ? "finale" : "tussentijdse"} evaluatie
                </p>
                <div className="card" style={{ marginBottom: 10 }}>
                  <div className="kv"><span className="k">Datum & tijdstip</span><span className="v">{formatDateTime(m.gepland_op)}</span></div>
                  {m.locatie && <div className="kv"><span className="k">{isPres ? "Lokaal/plaats" : "Plaats"}</span><span className="v">{m.locatie}</span></div>}
                </div>
                <p style={{ fontSize: 12.5, color: "var(--sub)" }}>
                  {isPres
                    ? "Je bent welkom bij de eindpresentatie van je stagiair; daarna volgt de finale beoordeling."
                    : "De docent komt langs op de werkvloer om samen met jou de voortgang van je stagiair te bespreken."}
                </p>
              </div>
              <div className="modal_footer">
                <button className="btn" disabled={bezig === m.id} onClick={() => openAlternatief(m)}>
                  <i className="ti ti-calendar-x" /> Past niet — ander moment
                </button>
                <button className="btn primary" disabled={bezig === m.id} onClick={() => handleBevestig(m.id)}>
                  <i className="ti ti-check" /> {bezig === m.id ? "Bezig..." : "Moment bevestigen"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Student selector — enkel bij meerdere stagiairs */}
      {!loading && studenten.length > 1 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card_title">Stagiair</div>
          <select
            className="form_input"
            value={geselecteerdDossier || ""}
            onChange={(e) => { const v = Number(e.target.value); setGeselecteerdDossier(v); onthoudMentorDossier(v); }}
          >
            {studenten.map((s) => (
              <option key={s.dossier_id} value={s.dossier_id}>
                {s.voornaam} {s.achternaam} — {s.bedrijf}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading && <div className="card"><p className="muted">Laden...</p></div>}

      {laadFout && (
        <div className="card" style={{ marginBottom: 12 }}>
          <span className="status s_rood">{laadFout}</span>
          <div style={{ marginTop: 10 }}>
            <button className="btn sm primary" onClick={() => (geselecteerdDossier ? loadPlanning(geselecteerdDossier, true) : window.location.reload())}>Opnieuw proberen</button>
          </div>
        </div>
      )}

      {!loading && !laadFout && studenten.length === 0 && (
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
        const teBevestigen = !dossierAfgerond && ["bedrijfsbezoek", "eindpresentatie"].includes(moment.type) && ["voorgesteld", "gepland"].includes(moment.status);
        const isAlternatifOpen = alternatifOpen === moment.id;

        return (
          <div
            key={moment.id}
            className="card"
            style={teBevestigen ? { marginBottom: 12, border: "1.5px solid #0a0a0a", boxShadow: "0 4px 14px rgba(0,0,0,.10)" } : { marginBottom: 12 }}
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
                  ? `${moment.voorgesteld_door_naam} stelt dit moment voor. Bevestig of stel een ander moment voor.`
                  : "Bevestig het moment of stel een ander moment voor."}
              </div>
            )}

            {teBevestigen && (
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn primary" disabled={bezig === moment.id} onClick={() => handleBevestig(moment.id)}>
                  <i className="ti ti-check" />{bezig === moment.id ? "Bezig..." : "Bevestigen"}
                </button>
                <button className="btn sm" disabled={bezig === moment.id} onClick={() => openAlternatief(moment)}>
                  <i className="ti ti-calendar-x" />Ander moment voorstellen
                </button>
              </div>
            )}

            {isAlternatifOpen && (
              <div className="modal_overlay" onClick={() => setAlternatifOpen(null)}>
                <div className="modal_box" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
                  <div className="modal_header">
                    <span className="modal_title">Ander moment voorstellen</span>
                    <button className="icon_btn" onClick={() => setAlternatifOpen(null)}><i className="ti ti-x" /></button>
                  </div>
                  <div className="modal_body">
                    <div className="form_group">
                      <label className="form_label">Plaats</label>
                      <input className="form_input" type="text" placeholder="bv. Bij het bedrijf of Online (Teams)" value={altPlaats} onChange={(e) => setAltPlaats(e.target.value)} />
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <div className="form_group" style={{ flex: 1 }}>
                        <label className="form_label">Datum <span style={{ color: "var(--red)" }}>*</span></label>
                        <input className="form_input" type="date" value={altDatum} onChange={(e) => setAltDatum(e.target.value)} />
                      </div>
                      <div className="form_group" style={{ width: 120 }}>
                        <label className="form_label">Uur <span style={{ color: "var(--red)" }}>*</span></label>
                        <input className="form_input" type="time" step="900" value={altUur} onChange={(e) => setAltUur(e.target.value)} />
                      </div>
                    </div>
                    <div className="form_group">
                      <label className="form_label">Toelichting / reden <span style={{ color: "var(--red)" }}>*</span></label>
                      <textarea className="form_input" style={{ minHeight: 60, fontSize: 12.5 }} placeholder="Waarom stel je een ander moment voor?" value={alternatifTekst} onChange={(e) => setAlternatifTekst(e.target.value)} />
                    </div>
                    {melding.id === moment.id && melding.tekst && melding.type === "s_rood" && (
                      <span className="status s_rood">{melding.tekst}</span>
                    )}
                  </div>
                  <div className="modal_footer">
                    <button className="btn" onClick={() => setAlternatifOpen(null)}>Annuleren</button>
                    <button className="btn primary" disabled={bezig === moment.id} onClick={() => handleAlternatief(moment.id)}>
                      <i className="ti ti-send" />{bezig === moment.id ? "Versturen..." : "Voorstel versturen"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
