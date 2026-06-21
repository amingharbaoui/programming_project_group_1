import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import "./MentorAfsprakenPage.css";
import { cacheGet, cacheSet, cacheDelete } from "../mentorCache";
import { kiesMentorStagiair, onthoudMentorDossier } from "../mentorSelection";

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

  const [searchParams] = useSearchParams();
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
        if (cached.length > 0) setGeselecteerdDossier(kiesMentorStagiair(cached, searchParams)?.dossier_id);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await api.get("/mentor/students");
        const data = res.data.data || [];
        cacheSet("mentor_students", data);
        setStudenten(data);
        if (data.length > 0) setGeselecteerdDossier(kiesMentorStagiair(data, searchParams)?.dossier_id);
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
    // Niets delen als alle velden leeg zijn: anders krijgt de student een melding zonder inhoud.
    if (!Object.values(veldenEdit).some((v) => String(v || "").trim() !== "")) {
      setMelding({ tekst: "Vul minstens één praktische afspraak in voor je ze deelt.", type: "s_rood" });
      return;
    }
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
  const dossierStatus = geselecteerdeStudent?.dossier_status || "";
  // Contract nog niet getekend/geregistreerd → afspraken pagina nog niet relevant
  const CONTRACT_FASES = ["wacht_op_student", "wacht_op_bedrijf", "in_controle_bij_administratie"];
  const AFGEROND_FASES = ["afgerond", "voltooid", "resultaat_vrijgegeven"];
  const contractNogNietKlaar = CONTRACT_FASES.includes(dossierStatus);
  const dossierAfgerond = AFGEROND_FASES.includes(dossierStatus);
  // Actiestijl: overeenkomst is geregistreerd maar afspraken nog niet gedeeld
  const isActieKaart = dossierStatus === "geregistreerd" && !gedeeldOp && !editMode;

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1>Praktische afspraken</h1>
        <p>Bekijk en bewerk de praktische afspraken voor je stagiair</p>
      </div>

      {/* Student selector */}
      {!loading && studenten.length > 1 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card_title">Stagiair</div>
          <select
            className="form_input"
            style={{ marginTop: 0 }}
            value={geselecteerdDossier || ""}
            onChange={(e) => { const v = Number(e.target.value); setGeselecteerdDossier(v); onthoudMentorDossier(v); }}
          >
            {studenten.map((s) => (
              <option key={s.dossier_id} value={s.dossier_id}>
                {s.voornaam} {s.achternaam} — {s.bedrijf}
                {AFGEROND_FASES.includes(s.dossier_status) ? " (afgerond)" : ""}
              </option>
            ))}
          </select>
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

      {/* Nog niet relevant: contract niet geregistreerd */}
      {!afsprakenLoading && geselecteerdDossier && contractNogNietKlaar && (
        <div className="card">
          <div className="card_title">
            <i className="ti ti-message-circle" style={{ color: "var(--sub)" }} />
            Praktische afspraken
            <span className="status s_grijs" style={{ marginLeft: "auto" }}>
              <i className="ti ti-lock" />Nog niet van toepassing
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--sub)", lineHeight: 1.6 }}>
            De stageovereenkomst moet eerst geregistreerd zijn voor je praktische afspraken kan delen.
          </p>
        </div>
      )}

      {!afsprakenLoading && geselecteerdDossier && !contractNogNietKlaar && (
        <div className="card" style={isActieKaart ? { border: "1.5px solid #0a0a0a", boxShadow: "0 4px 14px rgba(0,0,0,.10)" } : {}}>
          <div className="card_title">
            <i className="ti ti-message-circle" style={{ color: "var(--red)" }} />
            {gedeeldOp ? "Praktische afspraken & berichten" : "Praktische afspraken delen"}
            {gedeeldOp && !editMode && (
              <span className="status s_ok" style={{ marginLeft: "auto" }}>
                <i className="ti ti-check" />Gedeeld op {formatDate(gedeeldOp)}
              </span>
            )}
            {!gedeeldOp && !editMode && (
              <span className="status s_rood" style={{ marginLeft: "auto" }}>
                <i className="ti ti-pencil" />Te delen vóór de start
              </span>
            )}
          </div>

          {!editMode ? (
            <>
              {veldenOpgeslagen && Object.values(veldenOpgeslagen).some(Boolean) ? (
                <>
                  {AFSPRAAK_VELDEN.filter((v) => veldenOpgeslagen[v.key]).map((v) => (
                    <div className="kv" key={v.key}>
                      <span className="k">{v.label}</span>
                      <span className="v">{veldenOpgeslagen[v.key]}</span>
                    </div>
                  ))}
                  {gedeeldOp && (
                    <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 8 }}>
                      {geselecteerdeStudent?.voornaam || "De student"} ziet deze afspraken in het studentendashboard.
                    </p>
                  )}
                </>
              ) : (
                <p style={{ fontSize: 13, color: "var(--faint)" }}>Nog geen afspraken ingevoerd.</p>
              )}

              {melding.tekst && (
                <div style={{ marginTop: 10 }}>
                  <span className={`status ${melding.type}`}>{melding.tekst}</span>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
                {dossierAfgerond ? (
                  <span className="status s_grijs"><i className="ti ti-lock" />Dossier afgerond — read-only</span>
                ) : (
                  <button className="btn sm" onClick={startEdit}>
                    <i className="ti ti-pencil" />Bewerken
                  </button>
                )}
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
                <div style={{ marginBottom: 10 }}>
                  <span className={`status ${melding.type}`}>{melding.tekst}</span>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
                <button className="btn" onClick={annuleer} disabled={bezig}>Annuleren</button>
                <span style={{ fontSize: 11.5, color: "var(--faint)" }}>
                  {geselecteerdeStudent?.voornaam || "De student"} ziet deze afspraken in het studentendashboard.
                </span>
                <button className="btn primary" style={{ marginLeft: "auto" }} onClick={opslaan} disabled={bezig}>
                  <i className="ti ti-send" />{bezig ? "Opslaan..." : "Praktische afspraken delen"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
