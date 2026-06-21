import { useEffect, useState } from "react";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import "./DocentPlanningPage.css";
import { IconPlus, IconCheck, IconX, IconCalendarPlus, IconRefresh } from "@tabler/icons-react";
import { cacheGet, cacheSet, cacheDelete } from "../docentCache";

function formatDateTime(val) {
  if (!val) return "-";
  return new Date(val).toLocaleString("nl-BE", { dateStyle: "short", timeStyle: "short" });
}

// Alle mogelijke statussen van planning_momenten:
// voorgesteld · bevestigd · alternatief_gevraagd · gepland · gegeven · geweest · geannuleerd
function getStatusClass(status) {
  if (status === "bevestigd" || status === "gepland") return "s_ok";
  if (status === "voorgesteld") return "s_amber";
  if (status === "alternatief_gevraagd") return "s_amber";
  if (status === "gegeven" || status === "geweest") return "s_info";
  if (status === "geannuleerd") return "s_rood";
  return "s_grijs";
}

function getStatusLabel(status) {
  const labels = {
    voorgesteld:          "Wacht op bevestiging mentor",
    bevestigd:            "Bevestigd door mentor",
    alternatief_gevraagd: "Mentor stelt ander moment voor",
    gepland:              "Gepland",
    gegeven:              "Gegeven",
    geweest:              "Geweest",
    geannuleerd:          "Geannuleerd",
  };
  return labels[status] || status || "-";
}

const TYPE_OPTIES = [
  { key: "alle", label: "Alle types" },
  { key: "bedrijfsbezoek", label: "Bedrijfsbezoek" },
  { key: "eindpresentatie", label: "Eindpresentatie" },
];

export default function DocentPlanningPage() {
  const { user } = useAuth();
  const [planning, setPlanning] = useState([]);
  const [studenten, setStudenten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bezig, setBezig] = useState(false);
  const [succesModal, setSuccesModal] = useState("");
  const [foutModal, setFoutModal] = useState("");

  const [zoek, setZoek] = useState("");
  const [typeFilter, setTypeFilter] = useState("alle");

  const [nieuwModal, setNieuwModal] = useState(false);
  const [nieuwDossierId, setNieuwDossierId] = useState("");
  const [nieuwDatum, setNieuwDatum] = useState("");
  const [nieuwUur, setNieuwUur] = useState("10:00");
  const [nieuwLocatie, setNieuwLocatie] = useState("");
  const [nieuwDeelnemers, setNieuwDeelnemers] = useState("");
  const [nieuwType, setNieuwType] = useState("Bedrijfsbezoek");
  const [fout, setFout] = useState("");

  const [gegevenId, setGegevenId] = useState(null);
  const [altModal, setAltModal] = useState(null); // het planningmoment met mentor-alternatief
  const [altCounterDatum, setAltCounterDatum] = useState("");
  const [altCounterUur, setAltCounterUur] = useState("10:00");
  const [altCounterPlaats, setAltCounterPlaats] = useState("");

  async function loadPlanning(force = false) {
    try {
      setError("");
      if (!force) {
        const cachedPlan = cacheGet("docent_planning");
        const cachedStu  = cacheGet("docent_students");
        if (cachedPlan && cachedStu) {
          setPlanning(cachedPlan);
          setStudenten(cachedStu);
          setLoading(false);
          return;
        }
      }
      setLoading(true);
      const [planRes, stuRes] = await Promise.all([
        api.get("/docent/planning"),
        api.get("/docent/students"),
      ]);
      const planData = planRes.data.data || [];
      const stuData  = stuRes.data.data  || [];
      cacheSet("docent_planning", planData);
      cacheSet("docent_students", stuData);
      setPlanning(planData);
      setStudenten(stuData);
    } catch (err) {
      setError(err.response?.data?.message || "Planning ophalen mislukt");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPlanning(); }, []);

  const gefilterd = planning.filter((p) => {
    if (typeFilter !== "alle" && p.type !== typeFilter) return false;
    if (zoek) {
      const q = zoek.toLowerCase();
      if (!(p.student_naam || "").toLowerCase().includes(q) &&
          !(p.locatie || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Planning kan enkel voor dossiers die geregistreerd zijn of lopen (backend blokkeert de rest).
  const planbareStudenten = studenten.filter((s) =>
    ["geregistreerd", "stage_loopt", "actief"].includes(s.dossier_status)
  );

  function openModal() {
    setNieuwModal(true);
    setFout("");
    setNieuwDatum("");
    setNieuwUur("10:00");
    setNieuwLocatie("");
    setNieuwDeelnemers("");
    setNieuwType("Bedrijfsbezoek");
    setNieuwDossierId(planbareStudenten[0]?.dossier_id ? String(planbareStudenten[0].dossier_id) : "");
  }

  async function planNieuw() {
    if (!nieuwDatum || !nieuwDossierId) {
      setFout("Datum en student zijn verplicht.");
      return;
    }
    try {
      setBezig(true);
      setFout("");
      const isPresentatie = nieuwType === "Eindpresentatie";
      const endpoint = isPresentatie ? "/docent/planning/presentation" : "/docent/planning/visit";
      // Datum + uur samenvoegen tot één tijdstip (prototype gebruikt aparte velden).
      const geplandOp = `${nieuwDatum}T${nieuwUur || "00:00"}`;
      await api.post(endpoint, {
        dossierId: Number(nieuwDossierId),
        geplandOp,
        locatie: nieuwLocatie,
        ...(isPresentatie ? { deelnemers: nieuwDeelnemers } : {}),
      });
      setNieuwModal(false);
      cacheDelete("docent_planning");
      cacheDelete("docent_students");
      await loadPlanning(true);
      setSuccesModal("Moment succesvol ingepland.");
    } catch (err) {
      setFout(err.response?.data?.message || "Plannen mislukt.");
    } finally {
      setBezig(false);
    }
  }

  async function markeerGegeven(id, type) {
    const nieuweStatus = type === "bedrijfsbezoek" ? "geweest" : "gegeven";
    try {
      setGegevenId(id);
      await api.patch("/docent/planning/" + id, { status: nieuweStatus });
      cacheDelete("docent_planning");
      cacheDelete("docent_students");
      await loadPlanning(true);
      setSuccesModal(
        nieuweStatus === "geweest"
          ? "Het bedrijfsbezoek is bevestigd en gemarkeerd als geweest. De status is bijgewerkt in het dossier van de student."
          : "De eindpresentatie is bevestigd en gemarkeerd als gegeven. De status is bijgewerkt in het dossier van de student."
      );
    } catch (err) {
      setFoutModal(err.response?.data?.message || "Markeren mislukt");
    } finally {
      setGegevenId(null);
    }
  }

  // 446/480: docent accepteert het door de mentor voorgestelde alternatieve moment → bevestigd.
  // De mentor en student krijgen daarna de bevestigingsmelding (backend).
  async function accepteerAlternatief(id) {
    try {
      setGegevenId(id);
      await api.patch("/docent/planning/" + id, { status: "bevestigd" });
      setAltModal(null);
      cacheDelete("docent_planning");
      cacheDelete("docent_students");
      await loadPlanning(true);
      setSuccesModal("Het voorgestelde moment is bevestigd. De mentor en student zijn verwittigd.");
    } catch (err) {
      setFoutModal(err.response?.data?.message || "Bevestigen mislukt");
    } finally {
      setGegevenId(null);
    }
  }

  // 480: docent stuurt een tegenvoorstel — past het bestaande moment aan en zet het terug op 'voorgesteld'
  // zodat de mentor opnieuw bevestigt of een ander moment voorstelt (loop, geen dubbele planningrij).
  async function stuurTegenvoorstel(id) {
    if (!altCounterDatum) { setFoutModal("Kies een datum voor je tegenvoorstel."); return; }
    try {
      setGegevenId(id);
      await api.patch("/docent/planning/" + id, {
        status: "voorgesteld",
        geplandOp: `${altCounterDatum}T${altCounterUur || "00:00"}`,
        ...(altCounterPlaats ? { locatie: altCounterPlaats } : {}),
      });
      setAltModal(null);
      cacheDelete("docent_planning");
      cacheDelete("docent_students");
      await loadPlanning(true);
      setSuccesModal("Tegenvoorstel verstuurd. De mentor kan het bevestigen of opnieuw een ander moment voorstellen.");
    } catch (err) {
      setFoutModal(err.response?.data?.message || "Tegenvoorstel versturen mislukt");
    } finally {
      setGegevenId(null);
    }
  }

  function openAltModal(p) {
    const d = p.alternatief_gepland_op ? new Date(p.alternatief_gepland_op) : (p.gepland_op ? new Date(p.gepland_op) : null);
    setAltCounterDatum(d ? d.toISOString().slice(0, 10) : "");
    setAltCounterUur(d ? d.toTimeString().slice(0, 5) : "10:00");
    setAltCounterPlaats(p.alternatief_locatie || p.locatie || "");
    setAltModal(p);
  }

  const heeftFilters = typeFilter !== "alle" || zoek;

  return (
    <div className="page-inner">
      <div className="page-header">
        <div>
          <h1>Planning</h1>
          <p>Bedrijfsbezoeken en eindpresentaties beheren.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => loadPlanning(true)}><IconRefresh size={14} stroke={1.8} /> Vernieuwen</button>
          <button className="btn primary" onClick={openModal}>
            <IconPlus size={14} stroke={2} /> Inplannen
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="doc_filters" style={{ marginBottom: 16 }}>
        <input
          className="doc_zoek"
          placeholder="Zoek op student of locatie..."
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
        />
        <select
          className="doc_select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          {TYPE_OPTIES.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
        {heeftFilters && (
          <button className="btn sm primary" onClick={() => { setZoek(""); setTypeFilter("alle"); }}>
            <IconX size={16} stroke={1.8} /> Wis filters
          </button>
        )}
      </div>

      {loading && <div className="card"><p className="muted">Planning laden...</p></div>}
      {error && <div className="card"><span className="status s_rood">{error}</span></div>}

      {!loading && !error && gefilterd.length === 0 && (
        <div className="card"><p className="muted">Geen planning gevonden.</p></div>
      )}

      {!loading && !error && gefilterd.length > 0 && (
        <div className="card doc_students_card">
          <table className="doc_students_tbl">
            <thead>
              <tr>
                <th>Student</th>
                <th>Type</th>
                <th>Datum</th>
                <th>Locatie</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Acties</th>
              </tr>
            </thead>
            <tbody>
              {gefilterd.map((p) => {
                const initialen = (p.student_naam || "?").split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2);
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="doc_student_cell">
                        <div className="doc_avatar">{initialen}</div>
                        <div className="doc_student_info">
                          <div className="doc_naam">{p.student_naam || "-"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="doc_sub" style={{ textTransform: "capitalize" }}>
                      {p.type === "bedrijfsbezoek" ? "Bedrijfsbezoek" : "Eindpresentatie"}
                    </td>
                    <td className="doc_sub">{formatDateTime(p.gepland_op)}</td>
                    <td className="doc_sub">{p.locatie || "-"}</td>
                    <td>
                      <span className={"status " + getStatusClass(p.status)}>
                        {getStatusLabel(p.status)}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {["bevestigd", "gepland"].includes(p.status) && (
                        <button
                          className="btn sm"
                          disabled={gegevenId === p.id}
                          onClick={() => markeerGegeven(p.id, p.type)}
                        >
                          <IconCheck size={14} stroke={2} /> {p.type === "bedrijfsbezoek" ? "Markeer als geweest" : "Markeer als gegeven"}
                        </button>
                      )}
                      {/* 480: de mentor stelde een ander moment voor — open de pop-up om te bekijken,
                          accepteren of een tegenvoorstel te sturen. */}
                      {p.status === "alternatief_gevraagd" && (
                        <button className="btn sm primary" disabled={gegevenId === p.id} onClick={() => openAltModal(p)}>
                          <IconCheck size={14} stroke={2} /> Voorstel bekijken
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Nieuw modal — admin stijl */}
      {nieuwModal && (
        <div className="modal_overlay" onClick={() => setNieuwModal(false)}>
          <div className="modal_box" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal_header">
              <span className="modal_title">Moment inplannen</span>
              <button className="icon_btn" onClick={() => setNieuwModal(false)}><IconX size={16} stroke={1.8} /></button>
            </div>
            <div className="modal_body">
              <div className="form_group">
                <label className="form_label">Type <span style={{ color: "var(--red)" }}>*</span></label>
                <select className="form_input" value={nieuwType} onChange={(e) => setNieuwType(e.target.value)}>
                  <option value="Bedrijfsbezoek">Bedrijfsbezoek + tussentijdse evaluatie</option>
                  <option value="Eindpresentatie">Eindpresentatie</option>
                </select>
                {nieuwType === "Eindpresentatie" && (
                  <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    <i className="ti ti-info-circle" /> Een eindpresentatie kan pas ingepland worden nadat het bedrijfsbezoek heeft plaatsgevonden én de tussentijdse evaluatie geregistreerd is.
                  </p>
                )}
              </div>
              <div className="form_group">
                <label className="form_label">Student <span style={{ color: "var(--red)" }}>*</span></label>
                <select className="form_input" value={nieuwDossierId} onChange={(e) => setNieuwDossierId(e.target.value)}>
                  <option value="">-- Kies een student --</option>
                  {planbareStudenten.map((s) => (
                    <option key={s.dossier_id} value={s.dossier_id}>
                      {s.voornaam} {s.achternaam}
                    </option>
                  ))}
                </select>
                {planbareStudenten.length === 0 && (
                  <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Geen planbare studenten — planning kan pas zodra een stage geregistreerd is of loopt.
                  </p>
                )}
              </div>
              <div className="form_group">
                <label className="form_label">Plaats</label>
                <input className="form_input" type="text" placeholder="bv. Bij het bedrijf — adres, of Online (Teams)" value={nieuwLocatie} onChange={(e) => setNieuwLocatie(e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div className="form_group" style={{ flex: 1 }}>
                  <label className="form_label">Datum <span style={{ color: "var(--red)" }}>*</span></label>
                  <input className="form_input" type="date" value={nieuwDatum} onChange={(e) => setNieuwDatum(e.target.value)} />
                </div>
                <div className="form_group" style={{ width: 120 }}>
                  <label className="form_label">Uur <span style={{ color: "var(--red)" }}>*</span></label>
                  <input className="form_input" type="time" step="900" value={nieuwUur} onChange={(e) => setNieuwUur(e.target.value)} />
                </div>
              </div>
              {nieuwType === "Eindpresentatie" && (
                <div className="form_group">
                  <label className="form_label">Deelnemers</label>
                  <input className="form_input" type="text" placeholder="bv. docent, mentor, medestudenten" value={nieuwDeelnemers} onChange={(e) => setNieuwDeelnemers(e.target.value)} />
                </div>
              )}
              {fout && <div style={{ fontSize: "12px", color: "var(--red)", marginBottom: "4px" }}>{fout}</div>}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="btn primary" disabled={bezig} onClick={planNieuw}>
                  <IconCalendarPlus size={14} stroke={1.8} /> {bezig ? "Bezig..." : "Inplannen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 480: docent bekijkt het mentor-alternatief — accepteren of tegenvoorstel sturen */}
      {altModal && (
        <div className="modal_overlay" onClick={() => setAltModal(null)}>
          <div className="modal_box" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal_header">
              <span className="modal_title">Voorstel van de mentor</span>
              <button className="icon_btn" onClick={() => setAltModal(null)}><IconX size={16} stroke={1.8} /></button>
            </div>
            <div className="modal_body">
              <p style={{ fontSize: 13, color: "var(--sub)", marginTop: 0 }}>
                De mentor stelde een ander moment voor {altModal.type === "eindpresentatie" ? "de eindpresentatie" : "het bedrijfsbezoek"} voor.
              </p>
              {altModal.alternatief_voorstel && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11.5, color: "var(--faint)" }}>Toelichting mentor</div>
                  <div style={{ fontSize: 13, fontStyle: "italic" }}>"{altModal.alternatief_voorstel}"</div>
                  {altModal.alternatief_gepland_op && (
                    <div style={{ fontSize: 12.5, marginTop: 6 }}>Voorgesteld: <strong>{formatDateTime(altModal.alternatief_gepland_op)}</strong>{altModal.alternatief_locatie ? ` · ${altModal.alternatief_locatie}` : ""}</div>
                  )}
                </div>
              )}
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Accepteer het voorstel, of stuur een tegenvoorstel:</div>
              <div className="form_group">
                <label className="form_label">Plaats</label>
                <input className="form_input" type="text" value={altCounterPlaats} onChange={(e) => setAltCounterPlaats(e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div className="form_group" style={{ flex: 1 }}>
                  <label className="form_label">Datum</label>
                  <input className="form_input" type="date" value={altCounterDatum} onChange={(e) => setAltCounterDatum(e.target.value)} />
                </div>
                <div className="form_group" style={{ width: 120 }}>
                  <label className="form_label">Uur</label>
                  <input className="form_input" type="time" step="900" value={altCounterUur} onChange={(e) => setAltCounterUur(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="modal_footer" style={{ flexWrap: "wrap", gap: 8 }}>
              <button className="btn" onClick={() => setAltModal(null)}>Annuleren</button>
              <button className="btn" disabled={gegevenId === altModal.id} onClick={() => stuurTegenvoorstel(altModal.id)}>
                <IconCalendarPlus size={14} stroke={1.8} /> Tegenvoorstel sturen
              </button>
              <button className="btn primary" disabled={gegevenId === altModal.id} onClick={() => accepteerAlternatief(altModal.id)}>
                <IconCheck size={14} stroke={2} /> Voorstel accepteren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success modal */}
      {succesModal && (
        <div className="modal_overlay" onClick={() => setSuccesModal("")}>
          <div className="modal_box" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal_header">
              <span className="modal_title">Bevestiging geregistreerd</span>
              <button className="icon_btn" onClick={() => setSuccesModal("")}><IconX size={16} stroke={1.8} /></button>
            </div>
            <div className="modal_body">
              <p style={{ margin: 0, fontSize: 13, color: "var(--sub)" }}>{succesModal}</p>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button className="btn primary" onClick={() => setSuccesModal("")}>OK</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fout modal */}
      {foutModal && (
        <div className="modal_overlay" onClick={() => setFoutModal("")}>
          <div className="modal_box" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal_header">
              <span className="modal_title">Actie vereist</span>
              <button className="icon_btn" onClick={() => setFoutModal("")}><IconX size={16} stroke={1.8} /></button>
            </div>
            <div className="modal_body">
              <p style={{ margin: 0, fontSize: 13, color: "var(--sub)" }}>{foutModal}</p>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button className="btn primary" onClick={() => setFoutModal("")}>Sluiten</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
