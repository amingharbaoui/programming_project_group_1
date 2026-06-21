import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import "./MentorContractPage.css";
import { cacheGet, cacheSet, cacheDelete } from "../mentorCache";
import { kiesMentorStagiair, onthoudMentorDossier } from "../mentorSelection";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("nl-BE");
}

export default function MentorContractPage() {
  const { user } = useAuth();

  const [studenten, setStudenten]               = useState([]);
  const [searchParams]                          = useSearchParams();
  const [geselecteerdDossier, setGeselecteerdDossier] = useState(null);
  const [contract, setContract]                 = useState(null);
  const [loading, setLoading]                   = useState(true);
  const [contractLoading, setContractLoading]   = useState(false);
  const [bezig, setBezig]                       = useState(false);
  const [melding, setMelding]                   = useState({ tekst: "", type: "" });

  // Modal signing state
  const [tekenModal, setTekenModal]             = useState(false);
  const [akkoord, setAkkoord]                   = useState(false);
  const [akkoordFout, setAkkoordFout]           = useState(false);

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
    async function loadContract() {
      const cached = cacheGet(`mentor_contract_${geselecteerdDossier}`);
      if (cached !== null) { setContract(cached); setContractLoading(false); return; }
      try {
        setContractLoading(true);
        setMelding({ tekst: "", type: "" });
        setContract(null);
        const res = await api.get(`/mentor/contract/${geselecteerdDossier}`);
        const data = res.data.data;
        cacheSet(`mentor_contract_${geselecteerdDossier}`, data);
        setContract(data);
      } catch (err) {
        setContract(null);
      } finally {
        setContractLoading(false);
      }
    }
    loadContract();
  }, [geselecteerdDossier]);

  async function bevestigTekenen() {
    if (!akkoord) { setAkkoordFout(true); return; }
    setAkkoordFout(false);
    try {
      setBezig(true);
      cacheDelete(`mentor_contract_${geselecteerdDossier}`);
      cacheDelete("mentor_students");
      await api.patch(`/mentor/contract/${geselecteerdDossier}/teken`, { tekenbevoegd: true });
      const res = await api.get(`/mentor/contract/${geselecteerdDossier}`);
      const data = res.data.data;
      cacheSet(`mentor_contract_${geselecteerdDossier}`, data);
      setContract(data);
      setTekenModal(false);
      setAkkoord(false);
      setMelding({ tekst: "Stageovereenkomst ondertekend. Alle handtekeningen zijn binnen — de administratie controleert en registreert ze.", type: "s_ok" });
    } catch (err) {
      setMelding({ tekst: err.response?.data?.message || "Tekenen mislukt", type: "s_rood" });
      setTekenModal(false);
    } finally {
      setBezig(false);
    }
  }

  async function handleDownloadPdf() {
    if (!geselecteerdDossier) return;
    try {
      const res = await api.get(`/mentor/contract/${geselecteerdDossier}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url; a.download = "stageovereenkomst.pdf";
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setMelding({ tekst: err.response?.data?.message || "PDF downloaden mislukt", type: "s_rood" });
    }
  }

  const geselecteerdeStudent = studenten.find((s) => s.dossier_id === geselecteerdDossier);
  const studentNaam = geselecteerdeStudent ? `${geselecteerdeStudent.voornaam} ${geselecteerdeStudent.achternaam}` : "de student";
  const bedrijfNaam = geselecteerdeStudent?.bedrijf || "het stagebedrijf";

  // Contract status afleiding
  const st = contract?.status || "";
  const wachtOpStudent    = !contract?.student_getekend_op || ["klaar_voor_student", "wacht_op_bedrijf"].includes(st);
  const handtekeningNodig = !wachtOpStudent && !contract?.bedrijf_getekend_op;
  const volledigOndertekend = !!contract?.bedrijf_getekend_op && st !== "geregistreerd";
  const geregistreerd     = st === "geregistreerd";

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1>Stageovereenkomst</h1>
        <p>Bekijk en teken de stageovereenkomst van je stagiair</p>
      </div>

      {/* Student selector — enkel tonen als er meer dan 1 stagiair is */}
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

      {loading && <div className="card"><p style={{ color: "var(--sub)", fontSize: 13 }}>Laden…</p></div>}
      {!loading && studenten.length === 0 && <div className="card"><p style={{ color: "var(--sub)", fontSize: 13 }}>Geen gekoppelde stagiairs gevonden.</p></div>}
      {contractLoading && <div className="card"><p style={{ color: "var(--sub)", fontSize: 13 }}>Contract laden…</p></div>}

      {!contractLoading && geselecteerdDossier && !contract && (
        <div className="card"><p style={{ color: "var(--sub)", fontSize: 13 }}>Geen stageovereenkomst gevonden voor {studentNaam}.</p></div>
      )}

      {melding.tekst && (
        <div style={{ marginBottom: 12 }}>
          <span className={`status ${melding.type}`}>{melding.tekst}</span>
        </div>
      )}

      {!contractLoading && contract && (
        <>
          {/* ── Wacht op student ── */}
          {wachtOpStudent && (
            <div className="card">
              <div className="card_title">
                <i className="ti ti-file-certificate" style={{ color: "var(--red)" }} />
                Stageovereenkomst
                <span className="status s_grijs" style={{ marginLeft: "auto" }}>
                  <i className="ti ti-hourglass" />Wacht op student
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--sub)", lineHeight: 1.6 }}>
                De student moet de stageovereenkomst eerst ondertekenen. Jij krijgt een melding zodra dat gedaan is.
              </p>
              <div style={{ marginTop: 10 }}>
                <button className="btn sm" onClick={handleDownloadPdf}>
                  <i className="ti ti-eye" />Overeenkomst lezen
                </button>
              </div>
            </div>
          )}

          {/* ── Jouw handtekening nodig ── */}
          {handtekeningNodig && (
            <div className="card" style={{ border: "1.5px solid #0a0a0a", boxShadow: "0 4px 14px rgba(0,0,0,.10)" }}>
              <div className="card_title">
                <i className="ti ti-file-certificate" style={{ color: "var(--red)" }} />
                Stageovereenkomst
                <span className="status s_rood" style={{ marginLeft: "auto" }}>
                  <i className="ti ti-signature" />Jouw handtekening nodig
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--sub)", marginBottom: 12, lineHeight: 1.6 }}>
                <b>{studentNaam} ondertekende al op {formatDate(contract.student_getekend_op)}.</b>{" "}
                Lees de stageovereenkomst na en onderteken digitaal namens {bedrijfNaam} — niets afdrukken, scannen of doormailen.
                Na jouw handtekening controleert en registreert de administratie de stageovereenkomst; pas dan is de verzekering in orde.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn primary" onClick={() => { setAkkoord(false); setAkkoordFout(false); setTekenModal(true); }}>
                  <i className="ti ti-signature" />Digitaal ondertekenen
                </button>
                <button className="btn sm" onClick={handleDownloadPdf}>
                  <i className="ti ti-eye" />Volledige overeenkomst lezen
                </button>
              </div>
            </div>
          )}

          {/* ── Volledig ondertekend — in controle ── */}
          {volledigOndertekend && (
            <div className="card" style={{ borderLeft: "3px solid var(--red)" }}>
              <div className="card_title">
                <i className="ti ti-hourglass" style={{ color: "var(--red)" }} />
                Wacht op registratie door administratie
                <span className="status s_grijs" style={{ marginLeft: "auto" }}>
                  <i className="ti ti-shield" />In controle bij administratie
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--sub)", lineHeight: 1.6 }}>
                De stageovereenkomst is volledig ondertekend (student {formatDate(contract.student_getekend_op)} · jij namens {bedrijfNaam} op {formatDate(contract.bedrijf_getekend_op)}).
                De administratie controleert en registreert ze. Na registratie is de student verzekerd en kan de stage officieel starten. Jij hebt geen actie.
              </p>
            </div>
          )}

          {/* ── Geregistreerd ── */}
          {geregistreerd && (
            <div className="card">
              <div className="card_title">
                <i className="ti ti-shield-check" style={{ color: "var(--green, #16a34a)" }} />
                Stageovereenkomst
                <span className="status s_ok" style={{ marginLeft: "auto" }}>
                  <i className="ti ti-check" />Geregistreerd op {formatDate(contract.geregistreerd_op || contract.bedrijf_getekend_op)}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "var(--sub)", lineHeight: 1.6 }}>
                De administratie heeft de overeenkomst gecontroleerd en geregistreerd. De verzekering is in orde voor de volledige stageperiode.
              </p>
              <div style={{ marginTop: 10 }}>
                <button className="btn sm" onClick={handleDownloadPdf}>
                  <i className="ti ti-download" />PDF downloaden
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Bevestigingsmodal: digitaal ondertekenen ── */}
      {tekenModal && (
        <div className="modal-overlay" onClick={() => setTekenModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="mh-icon"><i className="ti ti-signature" /></div>
              <div>
                <div className="mh-t">Digitaal ondertekenen</div>
                <div className="mh-s">Stageovereenkomst · {studentNaam} × {bedrijfNaam}</div>
              </div>
              <button className="icon-btn mh-x btn sm" onClick={() => setTekenModal(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", fontSize: 12.5, lineHeight: 1.7, background: "#fff", marginBottom: 12 }}>
                Je ondertekent namens <b>{bedrijfNaam}</b> de stageovereenkomst met <b>{studentNaam}</b> en de opleiding.
                {contract?.student_getekend_op && <> De student ondertekende al op {formatDate(contract.student_getekend_op)}.</>}
              </div>
              <label style={{ display: "flex", gap: 8, fontSize: 13, alignItems: "flex-start", cursor: "pointer", marginBottom: 12 }}>
                <input
                  type="checkbox"
                  style={{ marginTop: 2 }}
                  checked={akkoord}
                  onChange={(e) => { setAkkoord(e.target.checked); setAkkoordFout(false); }}
                />
                Ik ben tekenbevoegd voor {bedrijfNaam}, heb de stageovereenkomst gelezen en onderteken digitaal
              </label>
              {akkoordFout && <p style={{ fontSize: 12, color: "var(--red)", marginBottom: 8 }}>Vink eerst de bevestiging aan.</p>}
              <button className="btn primary" onClick={bevestigTekenen} disabled={bezig}>
                <i className="ti ti-signature" />{bezig ? "Verwerken..." : "Digitaal ondertekenen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
