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

function getStatusClass(status) {
  if (status === "bevestigd") return "s_ok";
  if (status === "voorgesteld") return "s_amber";
  if (status === "gegeven" || status === "geweest" || status === "afgerond") return "s_info";
  if (status === "alternatief_gevraagd") return "s_amber";
  if (status === "geannuleerd") return "s_rood";
  return "s_grijs";
}

function getStatusLabel(status) {
  if (status === "bevestigd") return "Bevestigd";
  if (status === "voorgesteld") return "Wacht op bevestiging";
  if (status === "alternatief_gevraagd") return "Alternatief voorgesteld";
  if (status === "gegeven") return "Gegeven";
  if (status === "geweest") return "Geweest";
  if (status === "afgerond") return "Afgerond";
  if (status === "geannuleerd") return "Geannuleerd";
  return status || "-";
}

const AFGEHANDELD = ["gegeven", "geweest", "afgerond", "geannuleerd"];

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
  const [nieuwLocatie, setNieuwLocatie] = useState("");
  const [nieuwDeelnemers, setNieuwDeelnemers] = useState("");
  const [nieuwType, setNieuwType] = useState("Bedrijfsbezoek");
  const [fout, setFout] = useState("");

  const [gegevenId, setGegevenId] = useState(null);

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
      await api.post(endpoint, {
        dossierId: Number(nieuwDossierId),
        geplandOp: nieuwDatum,
        locatie: nieuwLocatie,
        ...(isPresentatie ? { deelnemers: nieuwDeelnemers } : {}),
      });
      setNieuwModal(false);
      cacheDelete("docent_planning");
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
                const afgehandeld = AFGEHANDELD.includes(p.status);
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
                      {!afgehandeld && (
                        <button
                          className="btn sm"
                          disabled={gegevenId === p.id}
                          onClick={() => markeerGegeven(p.id, p.type)}
                        >
                          <IconCheck size={14} stroke={2} /> Bevestigen
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
                  <option value="Bedrijfsbezoek">Bedrijfsbezoek</option>
                  <option value="Eindpresentatie">Eindpresentatie</option>
                </select>
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
                <label className="form_label">Datum en uur <span style={{ color: "var(--red)" }}>*</span></label>
                <input className="form_input" type="datetime-local" value={nieuwDatum} onChange={(e) => setNieuwDatum(e.target.value)} />
              </div>
              <div className="form_group">
                <label className="form_label">Locatie</label>
                <input className="form_input" type="text" placeholder="bv. Bedrijfsadres of Online (Teams)" value={nieuwLocatie} onChange={(e) => setNieuwLocatie(e.target.value)} />
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
