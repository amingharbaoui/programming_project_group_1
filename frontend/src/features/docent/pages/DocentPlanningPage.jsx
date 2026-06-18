import { useEffect, useState } from "react";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";

function formatDateTime(val) {
  if (!val) return "-";
  return new Date(val).toLocaleString("nl-BE", { dateStyle: "short", timeStyle: "short" });
}

function getStatusClass(status) {
  if (status === "bevestigd") return "s_ok";
  if (status === "voorgesteld") return "s_amber";
  if (status === "gegeven" || status === "afgerond") return "s_info";
  if (status === "geannuleerd") return "s_rood";
  return "s_grijs";
}

function getStatusLabel(status) {
  if (status === "bevestigd") return "Bevestigd";
  if (status === "voorgesteld") return "Wacht op bevestiging";
  if (status === "gegeven") return "Gegeven";
  if (status === "afgerond") return "Afgerond";
  if (status === "geannuleerd") return "Geannuleerd";
  return status || "-";
}

const TABS = ["Bedrijfsbezoek", "Eindpresentatie"];

export default function DocentPlanningPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("Bedrijfsbezoek");
  const [planning, setPlanning] = useState([]);
  const [studenten, setStudenten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bezig, setBezig] = useState(false);
  const [gelukt, setGelukt] = useState("");

  const [nieuwModal, setNieuwModal] = useState(false);
  const [nieuwDossierId, setNieuwDossierId] = useState("");
  const [nieuwDatum, setNieuwDatum] = useState("");
  const [nieuwLocatie, setNieuwLocatie] = useState("");
  const [fout, setFout] = useState("");

  const [gegevenId, setGegevenId] = useState(null);

  async function loadPlanning() {
    try {
      setLoading(true);
      setError("");
      const [planRes, stuRes] = await Promise.all([
        api.get("/docent/planning", { headers: { "x-user-id": String(user.id) } }),
        api.get("/docent/students", { headers: { "x-user-id": String(user.id) } }),
      ]);
      setPlanning(planRes.data.data || []);
      setStudenten(stuRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Planning ophalen mislukt");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPlanning(); }, []);

  const typeFilter = tab === "Bedrijfsbezoek" ? "bedrijfsbezoek" : "eindpresentatie";
  const gefilterd = planning.filter((p) => p.type === typeFilter);

  function openModal() {
    setNieuwModal(true);
    setFout("");
    setNieuwDatum("");
    setNieuwLocatie("");
    setNieuwDossierId(studenten[0]?.dossier_id ? String(studenten[0].dossier_id) : "");
  }

  async function planNieuw() {
    if (!nieuwDatum || !nieuwDossierId) {
      setFout("Datum en student zijn verplicht.");
      return;
    }
    try {
      setBezig(true);
      setFout("");
      const endpoint = tab === "Bedrijfsbezoek" ? "/docent/planning/visit" : "/docent/planning/presentation";
      await api.post(endpoint, {
        dossierId: Number(nieuwDossierId),
        geplandOp: nieuwDatum,
        locatie: nieuwLocatie,
      }, { headers: { "x-user-id": String(user.id) } });
      setGelukt("Moment ingepland!");
      setNieuwModal(false);
      await loadPlanning();
    } catch (err) {
      setFout(err.response?.data?.message || "Plannen mislukt.");
    } finally {
      setBezig(false);
    }
  }

  async function markeerGegeven(id) {
    try {
      setGegevenId(id);
      await api.patch("/docent/planning/" + id, { status: "gegeven" }, {
        headers: { "x-user-id": String(user.id) },
      });
      setGelukt("Gemarkeerd als gegeven!");
      await loadPlanning();
    } catch (err) {
      alert(err.response?.data?.message || "Markeren mislukt");
    } finally {
      setGegevenId(null);
    }
  }

  return (
    <div className="page_inner">
      <div className="page_header">
        <div>
          <h1>Planning</h1>
          <p>Bedrijfsbezoeken en eindpresentaties beheren.</p>
        </div>
        <div className="actions">
          <button className="btn sm" onClick={loadPlanning}>Vernieuwen</button>
          <button className="btn primary sm" onClick={openModal}>
            <i className="ti ti-plus" /> Inplannen
          </button>
        </div>
      </div>

      {gelukt && (
        <div className="card" style={{ marginBottom: "12px" }}>
          <span className="status s_ok"><i className="ti ti-circle-check" /> {gelukt}</span>
        </div>
      )}

      <div className="chips" style={{ marginBottom: "16px" }}>
        {TABS.map((t) => (
          <button key={t} className={"chip" + (tab === t ? " actief" : "")}
            onClick={() => { setTab(t); setGelukt(""); }}>
            {t}
          </button>
        ))}
      </div>

      {loading && <div className="card"><p className="muted">Planning laden...</p></div>}
      {error && <div className="card"><span className="status s_rood">{error}</span></div>}

      {!loading && !error && gefilterd.length === 0 && (
        <div className="empty_state">Geen {tab.toLowerCase()} gevonden.</div>
      )}

      {!loading && !error && gefilterd.length > 0 && (
        <div className="card">
          <div className="card_title">{tab} ({gefilterd.length})</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Student</th>
                <th>Datum</th>
                <th>Locatie</th>
                <th>Status</th>
                <th className="right">Acties</th>
              </tr>
            </thead>
            <tbody>
              {gefilterd.map((p) => (
                <tr key={p.id}>
                  <td>{p.student_naam || "-"}</td>
                  <td>{formatDateTime(p.gepland_op)}</td>
                  <td>{p.locatie || "-"}</td>
                  <td>
                    <span className={"status " + getStatusClass(p.status)}>
                      {getStatusLabel(p.status)}
                    </span>
                  </td>
                  <td className="right">
                    {p.status !== "gegeven" && p.status !== "afgerond" && (
                      <button className="btn sm" disabled={gegevenId === p.id}
                        onClick={() => markeerGegeven(p.id)}>
                        <i className="ti ti-check" /> Markeer als gegeven
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nieuwModal && (
        <div className="popup-overlay" onClick={() => setNieuwModal(false)}>
          <div className="popup" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <strong>{tab} inplannen</strong>
              <button className="btn sm" onClick={() => setNieuwModal(false)}>
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="popup-body">
              <div className="form_group">
                <label className="form_label">Student <span style={{ color: "var(--red)" }}>*</span></label>
                <select className="form_input" value={nieuwDossierId}
                  onChange={(e) => setNieuwDossierId(e.target.value)}>
                  <option value="">-- Kies een student --</option>
                  {studenten.map((s) => (
                    <option key={s.dossier_id} value={s.dossier_id}>
                      {s.voornaam} {s.achternaam}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form_group">
                <label className="form_label">Datum en uur <span style={{ color: "var(--red)" }}>*</span></label>
                <input className="form_input" type="datetime-local" value={nieuwDatum}
                  onChange={(e) => setNieuwDatum(e.target.value)} />
              </div>
              <div className="form_group">
                <label className="form_label">Locatie</label>
                <input className="form_input" type="text"
                  placeholder="bv. Bedrijfsadres of Online (Teams)"
                  value={nieuwLocatie} onChange={(e) => setNieuwLocatie(e.target.value)} />
              </div>
              {fout && <div style={{ fontSize: "12px", color: "var(--red)", marginBottom: "8px" }}>{fout}</div>}
              <button className="btn primary" style={{ width: "100%", justifyContent: "center" }}
                disabled={bezig} onClick={planNieuw}>
                <i className="ti ti-calendar-plus" /> {bezig ? "Bezig..." : "Inplannen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
