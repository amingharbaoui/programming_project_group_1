import { useEffect, useState } from "react";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("nl-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

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
  const [editWaarde, setEditWaarde]             = useState("");

  // Laad studenten van de mentor
  useEffect(() => {
    async function loadStudenten() {
      try {
        setLoading(true);
        const res = await api.get("/mentor/students", {
          headers: { "x-user-id": String(user.id) },
        });
        const data = res.data.data || [];
        setStudenten(data);
        if (data.length > 0) {
          setGeselecteerdDossier(data[0].dossier_id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadStudenten();
  }, []);

  // Laad afspraken voor geselecteerd dossier
  useEffect(() => {
    if (!geselecteerdDossier) return;
    async function loadAfspraken() {
      try {
        setAfsprakenLoading(true);
        setMelding({ tekst: "", type: "" });
        setEditMode(false);
        const res = await api.get(
          `/mentor/dossier/${geselecteerdDossier}/afspraken`,
          { headers: { "x-user-id": String(user.id) } }
        );
        const row = res.data.data;
        setAfspraken(row?.praktische_afspraken || "");
        setGedeeldOp(row?.praktische_afspraken_gedeeld_op || null);
      } catch (err) {
        setAfspraken("");
        setGedeeldOp(null);
      } finally {
        setAfsprakenLoading(false);
      }
    }
    loadAfspraken();
  }, [geselecteerdDossier]);

  function startEdit() {
    setEditWaarde(afspraken);
    setEditMode(true);
    setMelding({ tekst: "", type: "" });
  }

  function annuleer() {
    setEditMode(false);
    setEditWaarde("");
  }

  async function opslaan() {
    try {
      setBezig(true);
      setMelding({ tekst: "", type: "" });
      await api.patch(
        `/mentor/dossier/${geselecteerdDossier}/afspraken`,
        { afspraken: editWaarde },
        { headers: { "x-user-id": String(user.id) } }
      );
      setAfspraken(editWaarde);
      setGedeeldOp(new Date().toISOString());
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
              <div className="form_group">
                <label className="form_label">Afspraken</label>
                <textarea
                  className="form_input"
                  rows={8}
                  value={editWaarde}
                  onChange={(e) => setEditWaarde(e.target.value)}
                  style={{ resize: "vertical" }}
                  placeholder="Voer hier de praktische afspraken in..."
                />
              </div>

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
                  {bezig ? "Opslaan..." : "Opslaan"}
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
