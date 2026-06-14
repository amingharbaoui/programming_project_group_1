import { useEffect, useState } from "react";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("nl-BE");
}

function getContractStatusClass(status) {
  if (status === "volledig_ondertekend") return "s_ok";
  if (status === "getekend_door_student") return "s_amber";
  if (status === "klaar_voor_student") return "s_info";
  if (status === "wacht_op_bedrijf") return "s_amber";
  return "s_grijs";
}

function getContractStatusLabel(status) {
  if (status === "volledig_ondertekend") return "Volledig ondertekend";
  if (status === "getekend_door_student") return "Student getekend — wacht op mentor";
  if (status === "klaar_voor_student") return "Wacht op student";
  if (status === "wacht_op_bedrijf") return "Wacht op mentor/bedrijf";
  if (status === "in_controle_bij_administratie") return "In controle";
  if (status === "geregistreerd") return "Geregistreerd";
  return status || "-";
}

export default function MentorContractPage() {
  const { user } = useAuth();

  const [studenten, setStudenten] = useState([]);
  const [geselecteerdDossier, setGeselecteerdDossier] = useState(null);
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [contractLoading, setContractLoading] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState("");

  // Laad studentenlijst van de mentor
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

  // Laad contract wanneer dossier geselecteerd wordt
  useEffect(() => {
    if (!geselecteerdDossier) return;
    async function loadContract() {
      try {
        setContractLoading(true);
        setMelding("");
        setContract(null);
        const res = await api.get(`/mentor/contract/${geselecteerdDossier}`, {
          headers: { "x-user-id": String(user.id) },
        });
        setContract(res.data.data);
      } catch (err) {
        setContract(null);
      } finally {
        setContractLoading(false);
      }
    }
    loadContract();
  }, [geselecteerdDossier]);

  async function handleTekenen() {
    if (!geselecteerdDossier) return;
    try {
      setBezig(true);
      setMelding("");
      await api.patch(
        `/mentor/contract/${geselecteerdDossier}/teken`,
        {},
        { headers: { "x-user-id": String(user.id) } }
      );
      // Herlaad contract
      const res = await api.get(`/mentor/contract/${geselecteerdDossier}`, {
        headers: { "x-user-id": String(user.id) },
      });
      setContract(res.data.data);
      setMelding("Contract succesvol getekend!");
    } catch (err) {
      setMelding(err.response?.data?.message || "Tekenen mislukt");
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
          <h1>Stageovereenkomst</h1>
          <p>Bekijk en teken de stageovereenkomst van je stagiair.</p>
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

      {contractLoading && (
        <div className="card">
          <p className="muted">Contract laden...</p>
        </div>
      )}

      {!contractLoading && geselecteerdDossier && !contract && (
        <div className="empty_state">
          Geen stageovereenkomst gevonden voor{" "}
          {geselecteerdeStudent
            ? `${geselecteerdeStudent.voornaam} ${geselecteerdeStudent.achternaam}`
            : "deze stagiair"}.
        </div>
      )}

      {!contractLoading && contract && (
        <div className="card">
          <div className="card_title">
            Stageovereenkomst
            <span className={`status ${getContractStatusClass(contract.status)}`}>
              {getContractStatusLabel(contract.status)}
            </span>
          </div>

          <div className="kv">
            <span className="k">Student getekend op</span>
            <span className="v">{formatDate(contract.student_getekend_op)}</span>
          </div>
          <div className="kv">
            <span className="k">Bedrijf/mentor getekend op</span>
            <span className="v">{formatDate(contract.bedrijf_getekend_op)}</span>
          </div>
          <div className="kv">
            <span className="k">Versie</span>
            <span className="v">{contract.versie_nummer || 1}</span>
          </div>

          {melding && (
            <div style={{ marginTop: "12px" }}>
              <span className="status s_ok">{melding}</span>
            </div>
          )}

          {!contract.bedrijf_getekend_op && (
            <div className="actions" style={{ marginTop: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) handleTekenen();
                  }}
                  disabled={bezig}
                />
                <span style={{ fontSize: "13px" }}>
                  Ik bevestig dat ik de stageovereenkomst gelezen en goedgekeurd heb
                </span>
              </label>
              {bezig && <span className="muted">Verwerken...</span>}
            </div>
          )}

          {contract.bedrijf_getekend_op && (
            <div className="actions" style={{ marginTop: "16px" }}>
              <span className="status s_ok">Getekend op {formatDate(contract.bedrijf_getekend_op)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
