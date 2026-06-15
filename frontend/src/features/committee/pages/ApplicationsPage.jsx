import { useEffect, useState } from "react";
import api from "../../../services/api";
import "../../../index.css";
import "./ApplicationsPage.css";

/* ── Criteria die de commissie checkt ── */
const CRITERIA = [
  { id: "it_relevant",      label: "IT-relevante opdracht" },
  { id: "min_weken",        label: "Minimaal 12 weken stage" },
  { id: "tech_mentor",      label: "Technische mentor aanwezig" },
  { id: "geldige_periode",  label: "Geldige stageperiode (start vóór einde)" },
];

function formatDate(v) {
  if (!v) return "–";
  return new Date(v).toLocaleDateString("nl-BE");
}

function statusKlasse(status) {
  if (status === "goedgekeurd")           return "s_ok";
  if (status === "afgekeurd")             return "s_rood";
  if (status === "aanpassingen_gevraagd") return "s_amber";
  if (status === "ingediend")             return "s_info";
  if (status === "heringediend")          return "s_info";
  return "s_grijs";
}

function kanBeslissen(status) {
  return ["ingediend", "heringediend", "aanpassingen_gevraagd"].includes(status);
}

/* ── Beoordelingsmodal ── */
function BeoordelingModal({ aanvraag, onSluit, onBeslissing }) {
  const [criteria, setCriteria]         = useState({});
  const [beslissing, setBeslissing]     = useState(null); // "goedgekeurd"|"aanpassingen_gevraagd"|"afgekeurd"
  const [feedback, setFeedback]         = useState("");
  const [motivering, setMotivering]     = useState("");
  const [uitzondering, setUitzondering] = useState(false);
  const [uitzMot, setUitzMot]           = useState("");
  const [bezig, setBezig]               = useState(false);
  const [fout, setFout]                 = useState(null);

  const allesCriteria = CRITERIA.every((c) => criteria[c.id]);
  const waarschuwing  = beslissing === "goedgekeurd" && !allesCriteria;

  async function verstuur() {
    // Validaties
    if (beslissing === "aanpassingen_gevraagd" && !feedback.trim()) {
      setFout("Feedback is verplicht bij aanpassingen vragen.");
      return;
    }
    if ((beslissing === "afgekeurd" || beslissing === "goedgekeurd") && !motivering.trim()) {
      setFout("Motivering is verplicht.");
      return;
    }
    if (uitzondering && !uitzMot.trim()) {
      setFout("Motivering bij uitzondering is verplicht.");
      return;
    }

    setBezig(true);
    setFout(null);
    try {
      await api.patch(`/committee/applications/${aanvraag.id}/decision`, {
        beslissing,
        feedback:               feedback || null,
        motivering:             motivering || null,
        uitzonderingMotivering: uitzondering ? uitzMot : null,
      });
      onBeslissing();
      onSluit();
    } catch (err) {
      setFout(err.response?.data?.message || "Beslissing opslaan mislukt.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="popup-overlay">
      <div className="popup" style={{ maxWidth: 620, width: "100%" }}>

        {/* Header */}
        <div className="popup-header">
          <div className="card_title">Beoordeling — {aanvraag.bedrijf_naam}</div>
          <button className="btn" onClick={onSluit}>✕</button>
        </div>

        <div className="popup-body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Aanvraagdetails */}
          <section>
            <div className="form_label" style={{ marginBottom: 8 }}>Aanvraaggegevens</div>
            <div className="kv"><span className="k">Student</span><span className="v">{aanvraag.student_voornaam} {aanvraag.student_achternaam}</span></div>
            <div className="kv"><span className="k">Bedrijf</span><span className="v">{aanvraag.bedrijf_naam || "–"}</span></div>
            <div className="kv"><span className="k">Mentor</span><span className="v">{aanvraag.mentor_naam || "–"} ({aanvraag.mentor_email || "–"})</span></div>
            <div className="kv"><span className="k">Functie</span><span className="v">{aanvraag.stagefunctie || "–"}</span></div>
            <div className="kv"><span className="k">Periode</span><span className="v">{formatDate(aanvraag.startdatum)} – {formatDate(aanvraag.einddatum)} ({aanvraag.aantal_weken || "?"} weken)</span></div>
            <div className="kv"><span className="k">Uren/week</span><span className="v">{aanvraag.uren_per_week || "–"}</span></div>
            {aanvraag.opdrachtomschrijving && (
              <div style={{ marginTop: 8, fontSize: 13, color: "var(--sub)", lineHeight: 1.6 }}>
                <span style={{ fontWeight: 600, color: "var(--dark)" }}>Opdracht: </span>
                {aanvraag.opdrachtomschrijving}
              </div>
            )}
            {aanvraag.laatste_feedback && (
              <div style={{ marginTop: 8, padding: "8px 12px", background: "var(--red-light)", borderRadius: 8, fontSize: 12.5, color: "var(--red)" }}>
                <strong>Eerdere feedback:</strong> {aanvraag.laatste_feedback}
              </div>
            )}
          </section>

          {/* Criteria-checklist */}
          <section>
            <div className="form_label" style={{ marginBottom: 8 }}>Beoordelingscriteria</div>
            {CRITERIA.map((c) => (
              <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", cursor: "pointer", fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={!!criteria[c.id]}
                  onChange={(e) => setCriteria((prev) => ({ ...prev, [c.id]: e.target.checked }))}
                />
                {c.label}
              </label>
            ))}
            {waarschuwing && (
              <div style={{ marginTop: 6, padding: "8px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, fontSize: 12.5, color: "#92400e" }}>
                ⚠ Niet alle criteria zijn aangevinkt. Je kan goedkeuren met uitzondering.
              </div>
            )}
          </section>

          {/* Beslissing kiezen */}
          <section>
            <div className="form_label" style={{ marginBottom: 8 }}>Beslissing</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { val: "goedgekeurd",           label: "Goedkeuren",         cls: "btn primary" },
                { val: "aanpassingen_gevraagd", label: "Aanpassingen vragen", cls: "btn" },
                { val: "afgekeurd",             label: "Afkeuren",           cls: "btn danger" },
              ].map((b) => (
                <button
                  key={b.val}
                  className={`${b.cls}${beslissing === b.val ? " active-beslissing" : ""}`}
                  style={beslissing === b.val ? { outline: "2px solid var(--red)", outlineOffset: 2 } : {}}
                  onClick={() => { setBeslissing(b.val); setFout(null); }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </section>

          {/* Feedback / motivering velden afhankelijk van keuze */}
          {beslissing === "aanpassingen_gevraagd" && (
            <div className="form_group">
              <label className="form_label">Feedback aan student <span style={{ color: "var(--red)" }}>*</span></label>
              <textarea
                className="form_textarea"
                rows={3}
                placeholder="Welke aanpassingen zijn nodig?"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </div>
          )}

          {(beslissing === "goedgekeurd" || beslissing === "afgekeurd") && (
            <div className="form_group">
              <label className="form_label">Motivering <span style={{ color: "var(--red)" }}>*</span></label>
              <textarea
                className="form_textarea"
                rows={3}
                placeholder={beslissing === "goedgekeurd" ? "Stagevoorstel voldoet aan de criteria." : "Reden van afkeuring…"}
                value={motivering}
                onChange={(e) => setMotivering(e.target.value)}
              />
            </div>
          )}

          {beslissing === "goedgekeurd" && (
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={uitzondering} onChange={(e) => setUitzondering(e.target.checked)} />
                Goedkeuren met uitzondering
              </label>
              {uitzondering && (
                <div className="form_group" style={{ marginTop: 10 }}>
                  <label className="form_label">Motivering uitzondering <span style={{ color: "var(--red)" }}>*</span></label>
                  <textarea
                    className="form_textarea"
                    rows={2}
                    placeholder="Waarom wordt er een uitzondering toegestaan?"
                    value={uitzMot}
                    onChange={(e) => setUitzMot(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {fout && (
            <div style={{ padding: "8px 12px", background: "var(--red-light)", borderRadius: 8, fontSize: 13, color: "var(--red)" }}>
              {fout}
            </div>
          )}
        </div>

        {/* Acties */}
        <div className="actions" style={{ padding: "12px 20px", borderTop: "1px solid var(--border)" }}>
          <button className="btn" onClick={onSluit} disabled={bezig}>Annuleren</button>
          <button
            className="btn primary"
            disabled={!beslissing || bezig}
            onClick={verstuur}
          >
            {bezig ? "Bezig…" : "Beslissing bevestigen"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   Hoofdpagina
══════════════════════════════════════ */
export default function ApplicationsPage() {
  const [aanvragen, setAanvragen]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [fout, setFout]                 = useState("");
  const [geselecteerd, setGeselecteerd] = useState(null); // aanvraag in modal

  async function laadAanvragen() {
    try {
      setLoading(true);
      setFout("");
      const res = await api.get("/committee/applications");
      setAanvragen(res.data.data || []);
    } catch (err) {
      setFout(err.response?.data?.message || err.message || "Aanvragen ophalen mislukt");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { laadAanvragen(); }, []);

  const actief   = aanvragen.filter((a) => kanBeslissen(a.status));
  const behandeld = aanvragen.filter((a) => !kanBeslissen(a.status));

  return (
    <div className="page-inner">

      {geselecteerd && (
        <BeoordelingModal
          aanvraag={geselecteerd}
          onSluit={() => setGeselecteerd(null)}
          onBeslissing={laadAanvragen}
        />
      )}

      <div className="page-header">
        <div>
          <h1>Stageaanvragen</h1>
          <p>Beoordeel ingediende stagevoorstellen van studenten.</p>
        </div>
        <button className="btn sm" onClick={laadAanvragen}>Vernieuwen</button>
      </div>

      {loading && <div className="laadbericht">Aanvragen laden…</div>}
      {fout    && <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{fout}</div>}

      {/* Openstaande aanvragen */}
      {!loading && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="toolbar">
            <div className="card_title">
              Openstaand
              {actief.length > 0 && (
                <span style={{ marginLeft: 8, background: "var(--red)", color: "#fff", borderRadius: 10, fontSize: 11, padding: "2px 8px", fontWeight: 700 }}>
                  {actief.length}
                </span>
              )}
            </div>
          </div>

          {actief.length === 0 ? (
            <div className="empty-state">Geen openstaande aanvragen.</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Bedrijf</th>
                  <th>Periode</th>
                  <th>Versie</th>
                  <th>Status</th>
                  <th className="right">Actie</th>
                </tr>
              </thead>
              <tbody>
                {actief.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.student_voornaam} {a.student_achternaam}</strong><br />
                      <span className="muted">{a.studentennummer || "–"}</span>
                    </td>
                    <td>
                      <strong>{a.bedrijf_naam || "–"}</strong><br />
                      <span className="muted">{a.stagefunctie || "–"}</span>
                    </td>
                    <td>
                      {formatDate(a.startdatum)} – {formatDate(a.einddatum)}<br />
                      <span className="muted">{a.aantal_weken || "?"} weken · {a.totaal_uren || "?"} uur</span>
                    </td>
                    <td>v{a.huidige_versie_nummer || 1}</td>
                    <td><span className={`status ${statusKlasse(a.status)}`}>{a.status}</span></td>
                    <td className="right">
                      <button className="btn primary sm" onClick={() => setGeselecteerd(a)}>
                        Beoordelen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Behandelde aanvragen */}
      {!loading && behandeld.length > 0 && (
        <div className="card">
          <div className="card_title" style={{ marginBottom: 10 }}>Behandeld</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Student</th>
                <th>Bedrijf</th>
                <th>Ingediend</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {behandeld.map((a) => (
                <tr key={a.id}>
                  <td><strong>{a.student_voornaam} {a.student_achternaam}</strong></td>
                  <td>{a.bedrijf_naam || "–"}</td>
                  <td><span className="muted">{formatDate(a.ingediend_op)}</span></td>
                  <td><span className={`status ${statusKlasse(a.status)}`}>{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
