import { useEffect, useState } from "react";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import "./MentorAfsprakenPage.css";
import { cacheGet, cacheSet, cacheDelete } from "../mentorCache";

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("nl-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Story 29: praktische afspraken als losse velden i.p.v. één vrij tekstveld.
const AFSPRAAK_VELDEN = [
  { key: "werkuren", label: "Werkuren", placeholder: "Bv. 09:00 – 17:00" },
  { key: "thuiswerk", label: "Thuiswerk", placeholder: "Bv. 2 dagen per week" },
  { key: "eersteDag", label: "Eerste werkdag", placeholder: "Bv. 02/02/2026" },
  { key: "contactpersoon", label: "Contactpersoon", placeholder: "Naam + functie" },
  { key: "materiaal", label: "Benodigd materiaal", placeholder: "Bv. laptop, badge" },
  { key: "extra", label: "Extra info", placeholder: "Overige afspraken" },
];

const LEGE_VELDEN = { werkuren: "", thuiswerk: "", eersteDag: "", contactpersoon: "", materiaal: "", extra: "" };

export default function MentorAfsprakenPage() {
  const { user } = useAuth();

  const [studenten, setStudenten]               = useState([]);
  const [geselecteerdDossier, setGeselecteerdDossier] = useState(null);
  const [afspraken, setAfspraken]               = useState("");
  const [gedeeldOp, setGedeeldOp]               = useState(null);
  const [loading, setLoading]                   = useState(true);
  const [afsprakenLoading, setAfsprakenLoading] = useState(false);
  const [bezig, setBezig]                       = useState(false);
  const [melding, setMelding]                   = useState({ tekst: "", type: "" });
  const [editMode, setEditMode]                 = useState(false);
  const [veldenOpgeslagen, setVeldenOpgeslagen] = useState(null);
  const [veldenEdit, setVeldenEdit]             = useState({ ...LEGE_VELDEN });

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
    async function loadAfspraken() {
      const cached = cacheGet(`mentor_afspraken_${geselecteerdDossier}`);
      if (cached) {
        setAfspraken(cached.tekst || "");
        setGedeeldOp(cached.gedeeldOp || null);
        setVeldenOpgeslagen(cached.velden || null);
        setAfsprakenLoading(false);
        return;
      }
      try {
        setAfsprakenLoading(true);
        setMelding({ tekst: "", type: "" });
        setEditMode(false);
        const res = await api.get(`/mentor/dossier/${geselecteerdDossier}/afspraken`);
        const row = res.data.data;
        const tekst = row?.praktische_afspraken || "";
        const gedeeldOp = row?.praktische_afspraken_gedeeld_op || null;
        let velden = null;
        if (row?.praktische_afspraken_velden) {
          try {
            velden = typeof row.praktische_afspraken_velden === "string"
              ? JSON.parse(row.praktische_afspraken_velden)
              : row.praktische_afspraken_velden;
          } catch { velden = null; }
        }
        cacheSet(`mentor_afspraken_${geselecteerdDossier}`, { tekst, gedeeldOp, velden });
        setAfspraken(tekst);
        setGedeeldOp(gedeeldOp);
        setVeldenOpgeslagen(velden);
      } catch (err) {
        setAfspraken("");
        setGedeeldOp(null);
        setVeldenOpgeslagen(null);
      } finally {
        setAfsprakenLoading(false);
      }
    }
    loadAfspraken();
  }, [geselecteerdDossier]);

  function startEdit() {
    setVeldenEdit({ ...LEGE_VELDEN, ...(veldenOpgeslagen || {}) });
    setEditMode(true);
    setMelding({ tekst: "", type: "" });
  }

  function annuleer() {
    setEditMode(false);
    setVeldenEdit({ ...LEGE_VELDEN });
  }

  function wijzigVeld(key, waarde) {
    setVeldenEdit((vorig) => ({ ...vorig, [key]: waarde }));
  }

  async function opslaan() {
    try {
      setBezig(true);
      setMelding({ tekst: "", type: "" });
      await api.patch(`/mentor/dossier/${geselecteerdDossier}/afspraken`, { velden: veldenEdit });
      cacheDelete(`mentor_afspraken_${geselecteerdDossier}`);
      const res = await api.get(`/mentor/dossier/${geselecteerdDossier}/afspraken`);
      const row = res.data?.data;
      const tekst = row?.praktische_afspraken || "";
      const gedeeldOp = row?.praktische_afspraken_gedeeld_op || new Date().toISOString();
      cacheSet(`mentor_afspraken_${geselecteerdDossier}`, { tekst, gedeeldOp, velden: { ...veldenEdit } });
      setAfspraken(tekst);
      setVeldenOpgeslagen({ ...veldenEdit });
      setGedeeldOp(gedeeldOp);
      setEditMode(false);
      setMelding({ tekst: "Afspraken opgeslagen!", type: "s_ok" });
    } catch (err) {
      setMelding({
        tekst: err.response?.data?.message || "Opslaan mislukt",
        type: "s_rood",
      });
    } finally {
      setBezig(false);
    }
  }

  const geselecteerdeStudent = studenten.find(
    (s) => s.dossier_id === geselecteerdDossier
  );

  return (
    <div className="page_inner">
      <div className="page_header">
        <div>
          <h1>Praktische afspraken</h1>
          <p>Bekijk en bewerk de praktische afspraken voor je stagiair.</p>
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

      {loading && (
        <div className="card">
          <p className="muted">Laden...</p>
        </div>
      )}

      {!loading && studenten.length === 0 && (
        <div className="empty_state">Geen gekoppelde stagiairs gevonden.</div>
      )}

      {afsprakenLoading && (
        <div className="card">
          <p className="muted">Afspraken laden...</p>
        </div>
      )}

      {!afsprakenLoading && geselecteerdDossier && (
        <div className="card">
          <div className="card_title">
            Praktische afspraken
            {geselecteerdeStudent && (
              <span className="muted" style={{ fontWeight: 400, fontSize: "13px" }}>
                {" "}— {geselecteerdeStudent.voornaam} {geselecteerdeStudent.achternaam}
              </span>
            )}
          </div>

          {gedeeldOp && (
            <p className="muted" style={{ fontSize: "12px", marginBottom: "12px" }}>
              Laatst gedeeld op {formatDate(gedeeldOp)}
            </p>
          )}

          {!editMode ? (
            <>
              <div
                style={{
                  background: "var(--bg-secondary, #f5f5f5)",
                  borderRadius: "8px",
                  padding: "14px",
                  minHeight: "80px",
                  whiteSpace: "pre-wrap",
                  fontSize: "14px",
                  lineHeight: "1.6",
                  color: afspraken ? "inherit" : "var(--text-muted, #aaa)",
                }}
              >
                {afspraken || "Nog geen afspraken ingevoerd."}
              </div>

              {melding.tekst && (
                <div style={{ marginTop: "10px" }}>
                  <span className={`status ${melding.type}`}>{melding.tekst}</span>
                </div>
              )}

              <div className="actions" style={{ marginTop: "16px" }}>
                <button className="btn primary" onClick={startEdit}>
                  <i className="ti ti-pencil" /> Bewerken
                </button>
              </div>
            </>
          ) : (
            <>
              {AFSPRAAK_VELDEN.map((veld) => (
                <div className="form_group" key={veld.key}>
                  <label className="form_label">{veld.label}</label>
                  {veld.key === "extra" ? (
                    <textarea
                      className="form_input"
                      rows={3}
                      value={veldenEdit[veld.key]}
                      onChange={(e) => wijzigVeld(veld.key, e.target.value)}
                      style={{ resize: "vertical" }}
                      placeholder={veld.placeholder}
                    />
                  ) : (
                    <input
                      className="form_input"
                      type="text"
                      value={veldenEdit[veld.key]}
                      onChange={(e) => wijzigVeld(veld.key, e.target.value)}
                      placeholder={veld.placeholder}
                    />
                  )}
                </div>
              ))}

              {melding.tekst && (
                <div style={{ marginBottom: "10px" }}>
                  <span className={`status ${melding.type}`}>{melding.tekst}</span>
                </div>
              )}

              <div className="actions">
                <button
                  className="btn primary"
                  onClick={opslaan}
                  disabled={bezig}
                >
                  <i className="ti ti-device-floppy" />{bezig ? "Opslaan..." : "Opslaan"}
                </button>
                <button className="btn" onClick={annuleer} disabled={bezig}>
                  Annuleren
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
