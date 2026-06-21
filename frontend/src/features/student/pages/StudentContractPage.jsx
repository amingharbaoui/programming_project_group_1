import { useState, useEffect } from "react";
import api, { apiRequest } from "../../../services/api";
import { cacheGet, cacheSet, cacheDelete } from "../studentCache";
import "./StudentContractPage.css";
import Modal from "../../../components/ui/Modal";
import {
  IconFileCheck,
  IconWriting,
  IconAlertCircle,
} from "@tabler/icons-react";

function formatDatumTijd(d) {
  if (!d) return null;
  return new Date(d).toLocaleString("nl-BE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDatumKort(d) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("nl-BE", { day: "numeric", month: "long" });
}

function formatPeriode(start, einde) {
  if (!start && !einde) return "–";
  const fmt = (d) => d ? new Date(d).toLocaleDateString("nl-BE") : "–";
  return `${fmt(start)} – ${fmt(einde)}`;
}

function HandtekeningBadge({ getekendOp, wachtLabel = "Wacht" }) {
  if (getekendOp) {
    return (
      <span className="contract-pill ok">
        <i className="ti ti-check"></i>
        Getekend
      </span>
    );
  }
  return (
    <span className="contract-pill wait">
      <i className="ti ti-hourglass"></i>
      {wachtLabel}
    </span>
  );
}

function ContractStatusTekst({ contract }) {
  if (!contract.student_getekend_op) {
    return <>Je stageovereenkomst staat klaar. Lees ze na en onderteken digitaal om verder te gaan.</>;
  }
  if (!contract.bedrijf_getekend_op) {
    return <>Jij tekende op {formatDatumKort(contract.student_getekend_op)}. {contract.bedrijf_naam || "Het stagebedrijf"} kreeg een uitnodiging om de stageovereenkomst te ondertekenen — jij hoeft niets te doen.</>;
  }
  if (!contract.opleiding_getekend_op && contract.status !== "geregistreerd") {
    return <>Alle handtekeningen van student en bedrijf zijn binnen. De overeenkomst is in controle bij de opleiding.</>;
  }
  return <>De stageovereenkomst is volledig ondertekend en geregistreerd. Je verzekering is in orde voor de stageperiode.</>;
}

function HandtekeningRij({ type, titel, naam, detail, getekendOp, wachtLabel }) {
  return (
    <div className="contract-sign-row">
      <div className="contract-sign-icon">
        <i className={`ti ${getekendOp ? "ti-check" : type}`}></i>
      </div>
      <div className="contract-sign-main">
        <div className="contract-sign-title">{titel}</div>
        <div className="contract-sign-sub">{naam || "–"}{detail ? ` · ${detail}` : ""}</div>
      </div>
      <HandtekeningBadge getekendOp={getekendOp} wachtLabel={wachtLabel} />
    </div>
  );
}

export default function StudentContractPage() {
  const [contract, setContract] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [fout, setFout]         = useState(null);
  const [akkoord, setAkkoord]   = useState(false);
  const [bezig, setBezig]       = useState(false);
  const [succesmelding, setSuccesmelding] = useState(null);
  const [overeenkomstOpen, setOvereenkomstOpen] = useState(false);
  const [herinneringOpen, setHerinneringOpen] = useState(false);

  useEffect(() => { laadContract(); }, []);

  async function laadContract(force = false) {
    setLoading(true);
    setFout(null);
    try {
      // Het contract wordt ook door mentor/administratie gewijzigd → met 'force' verse data ophalen.
      const cached = force ? null : cacheGet("student_contract");
      const data = cached ?? (await apiRequest("GET", "/contracts/my")).data;
      if (!cached && data) cacheSet("student_contract", data);
      setContract(data);
    } catch (err) {
      setFout(err.response?.data?.message || "Stageovereenkomst kon niet geladen worden.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOndertekenen() {
    if (!akkoord) return;
    setBezig(true);
    setFout(null);
    try {
      const res = await apiRequest("POST", "/contracts/sign", { bevestigd: true });
      cacheDelete("student_contract");
      await laadContract();
      setAkkoord(false);
      setSuccesmelding(formatDatumTijd(res.data.getekendOp));
    } catch (err) {
      setFout(err.response?.data?.message || "Ondertekenen mislukt.");
    } finally {
      setBezig(false);
    }
  }

  async function handleDownloadPdf() {
    try {
      const res = await api.get("/contracts/my/pdf", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "stageovereenkomst.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setFout("PDF downloaden mislukt.");
    }
  }

  if (loading) {
    return (
      <div className="page-inner">
        <div className="page-header"><h1>Stageovereenkomst</h1></div>
        <div className="card"><p>Laden…</p></div>
      </div>
    );
  }

  if (!contract) {
    // 441: een technische laadfout niet verbergen als "geen overeenkomst" — toon de echte fout + retry.
    return (
      <div className="page-inner">
        <div className="page-header"><h1>Stageovereenkomst</h1></div>
        {fout ? (
          <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
            <p style={{ color: "var(--red)", marginBottom: 12 }}>{fout}</p>
            <button className="btn primary sm" onClick={() => laadContract(true)}>Opnieuw proberen</button>
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
            <IconFileCheck size={36} style={{ color: "var(--sub)", marginBottom: 12 }} />
            <p style={{ color: "var(--sub)" }}>Er is nog geen stageovereenkomst beschikbaar.</p>
          </div>
        )}
      </div>
    );
  }

  const alGetekend      = !!contract.student_getekend_op;
  const kanOndertekenen = !alGetekend && (contract.status === "klaar_voor_student" || !contract.status);
  const wachtOpBedrijf  = !!contract.student_getekend_op && !contract.bedrijf_getekend_op;

  return (
    <div className="page-inner">

      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Stageovereenkomst</h1>
        <button className="btn sm" onClick={() => laadContract(true)} disabled={loading}>Vernieuwen</button>
      </div>

      {fout && (
        <div className="card">
          <span className="status s_rood"><IconAlertCircle size={14} /> {fout}</span>
        </div>
      )}

      {/* Succesmodal na ondertekenen */}
      <Modal
        open={!!succesmelding}
        onClose={() => setSuccesmelding(null)}
        icon="ti-signature"
        titel="Stageovereenkomst ondertekend"
        sub={succesmelding ? `Ondertekend op ${succesmelding}` : ""}
        footer={
          <button className="btn primary" onClick={() => setSuccesmelding(null)}>
            <i className="ti ti-check"></i> Begrepen
          </button>
        }
      >
        <p>Je handtekening is geregistreerd. De overeenkomst wordt nu doorgezonden naar het bedrijf voor hun handtekening.</p>
      </Modal>

      <Modal
        open={overeenkomstOpen}
        onClose={() => setOvereenkomstOpen(false)}
        icon="ti-file-certificate"
        titel="Stageovereenkomst"
        sub="Automatisch opgesteld uit je goedgekeurde voorstel"
        footer={
          <button className="btn primary" onClick={() => setOvereenkomstOpen(false)}>
            <i className="ti ti-check"></i> Sluiten
          </button>
        }
      >
        <p>
          <strong>Student:</strong> {contract.student_naam || "–"}<br />
          <strong>Stagebedrijf:</strong> {contract.bedrijf_naam || "–"}<br />
          <strong>Mentor:</strong> {contract.mentor_naam || "–"}<br />
          <strong>Begeleidend docent:</strong> {contract.docent_naam || "–"}<br />
          <strong>Periode:</strong> {formatPeriode(contract.startdatum, contract.einddatum)}<br /><br />
          De partijen verklaren akkoord te gaan met de stageafspraken, begeleiding, evaluatie en verzekeringsvoorwaarden zoals vastgelegd door de opleiding.
        </p>
      </Modal>

      <Modal
        open={herinneringOpen}
        onClose={() => setHerinneringOpen(false)}
        icon="ti-bell"
        titel="Herinnering klaar"
        sub="Wacht op handtekening van het bedrijf"
        footer={
          <button className="btn primary" onClick={() => setHerinneringOpen(false)}>
            <i className="ti ti-check"></i> Begrepen
          </button>
        }
      >
        <p>De stagecoördinator of administratie kan het bedrijf herinneren om de stageovereenkomst digitaal te ondertekenen.</p>
      </Modal>

      <div className="contract-status-line">
        <i className="ti ti-hourglass-empty"></i>
        <span><ContractStatusTekst contract={contract} /></span>
      </div>

      {wachtOpBedrijf && (
        <button className="btn contract-reminder" onClick={() => setHerinneringOpen(true)}>
          <i className="ti ti-info-circle"></i>
          Wat als het bedrijf nog niet tekent?
        </button>
      )}

      <div className="contract-grid">
        <div className="card contract-card">
          <div className="card_title contract-card-title">
            <i className="ti ti-signature"></i>
            Handtekeningen
          </div>

          <div className="contract-sign-list">
            <HandtekeningRij
              type="ti-user"
              titel="Jij (student)"
              naam={contract.student_naam}
              detail={contract.student_getekend_op ? `getekend op ${formatDatumKort(contract.student_getekend_op)}` : "nog te ondertekenen"}
              getekendOp={contract.student_getekend_op}
              wachtLabel="Te tekenen"
            />
            <HandtekeningRij
              type="ti-building"
              titel="Het stagebedrijf"
              naam={contract.bedrijf_naam}
              detail={contract.mentor_naam}
              getekendOp={contract.bedrijf_getekend_op}
              wachtLabel="Wacht"
            />
            <HandtekeningRij
              type="ti-school"
              titel="De opleiding"
              naam="Erasmushogeschool Brussel"
              detail={contract.opleiding_getekend_op ? `getekend op ${formatDatumKort(contract.opleiding_getekend_op)}` : contract.docent_naam}
              getekendOp={contract.opleiding_getekend_op || contract.status === "geregistreerd"}
              wachtLabel="Controle"
            />
          </div>

          <p className="contract-help">
            Iedereen tekent digitaal in de tool, in deze volgorde. Zodra alle handtekeningen binnen zijn, controleert en registreert de administratie de stageovereenkomst. Na registratie is je verzekering in orde.
          </p>
        </div>

        <div className="card contract-card">
          <div className="card_title contract-card-title">
            <i className="ti ti-file-certificate"></i>
            Wat er in je stageovereenkomst staat
          </div>

          <div className="contract-kv">
            <div><span>Student</span><strong>{contract.student_naam || "–"}</strong></div>
            <div><span>Stagebedrijf</span><strong>{contract.bedrijf_naam || "–"}</strong></div>
            <div><span>Mentor</span><strong>{contract.mentor_naam || "–"}</strong></div>
            <div><span>Begeleidend docent</span><strong>{contract.docent_naam || "–"}</strong></div>
            <div><span>Periode</span><strong>{formatPeriode(contract.startdatum, contract.einddatum)}</strong></div>
            <div><span>Verzekering</span><strong>Via EhB tijdens de stage</strong></div>
          </div>

          <p className="contract-help compact">
            Alles wordt automatisch overgenomen uit je goedgekeurde voorstel. Klopt er iets niet? Onderteken dan niet en contacteer de stagecoördinator.
          </p>

          <div className="actions" style={{ marginTop: 4 }}>
            <button className="btn sm" onClick={() => setOvereenkomstOpen(true)}>
              <i className="ti ti-eye"></i>
              Volledige overeenkomst lezen
            </button>
            <button className="btn sm" onClick={handleDownloadPdf}>
              <i className="ti ti-download"></i>
              PDF downloaden
            </button>
          </div>
        </div>
      </div>

      {/* Ondertekenen */}
      {kanOndertekenen && (
        <div className="card contract-sign-action">
          <div className="card_title">
            <IconWriting size={16} />
            Ondertekenen
          </div>
          <div className="akkoord-row">
            <label className="akkoord-label">
              <input type="checkbox" checked={akkoord} onChange={(e) => setAkkoord(e.target.checked)} />
              Door te ondertekenen bevestig je dat je de stageovereenkomst hebt gelezen en akkoord gaat met de inhoud ervan.
            </label>
            <button className="btn primary" disabled={!akkoord || bezig} onClick={handleOndertekenen} style={{ flexShrink: 0 }}>
              <IconWriting size={15} />
              {bezig ? "Bezig…" : "Digitaal ondertekenen"}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
