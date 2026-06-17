import { useState, useEffect } from "react";
import { apiRequest } from "../../../services/api";
import "./StudentContractPage.css";
import Modal from "../../../components/ui/Modal";
import {
  IconFileCheck,
  IconBuilding,
  IconWriting,
  IconCircleCheck,
  IconClock,
  IconAlertCircle,
  IconPrinter,
} from "@tabler/icons-react";

function formatDatum(d) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("nl-BE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

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

const STATUS_MAP = {
  klaar_voor_student:            ["s_blauw", "Klaar voor ondertekening"],
  getekend_door_student:         ["s_ok",    "Getekend door jou"],
  wacht_op_bedrijf:              ["s_amber", "Wacht op bedrijf"],
  volledig_ondertekend:          ["s_ok",    "Volledig ondertekend"],
  in_controle_bij_administratie: ["s_blauw", "Bij administratie"],
  afgekeurd:                     ["s_rood",  "Afgekeurd"],
  geregistreerd:                 ["s_ok",    "Geregistreerd"],
};

function ContractBadge({ status }) {
  const [cls, label] = STATUS_MAP[status] ?? ["s_grijs", status ?? "Onbekend"];
  return <span className={`status ${cls}`}>{label}</span>;
}

function HandtekeningBadge({ getekendOp }) {
  if (getekendOp) {
    return (
      <span className="hb-getekend">
        <IconCircleCheck size={13} />
        {formatDatumTijd(getekendOp)}
      </span>
    );
  }
  return (
    <span className="hb-wacht">
      <IconClock size={13} />
      Wacht op ondertekening
    </span>
  );
}

function Partij({ titel, naam, getekendOp }) {
  return (
    <div className="partij">
      <div className="partij-titel">{titel}</div>
      <div className="partij-naam">{naam || "–"}</div>
      <HandtekeningBadge getekendOp={getekendOp} />
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

  useEffect(() => { laadContract(); }, []);

  async function laadContract() {
    setLoading(true);
    setFout(null);
    try {
      const res = await apiRequest("GET", "/contracts/my");
      setContract(res.data);
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
      const res = await apiRequest("POST", "/contracts/sign");
      await laadContract();
      setAkkoord(false);
      setSuccesmelding(formatDatumTijd(res.data.getekendOp));
    } catch (err) {
      setFout(err.response?.data?.message || "Ondertekenen mislukt.");
    } finally {
      setBezig(false);
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
    return (
      <div className="page-inner">
        <div className="page-header"><h1>Stageovereenkomst</h1></div>
        <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
          <IconFileCheck size={36} style={{ color: "var(--sub)", marginBottom: 12 }} />
          <p style={{ color: "var(--sub)" }}>Er is nog geen stageovereenkomst beschikbaar.</p>
        </div>
      </div>
    );
  }

  const alGetekend      = !!contract.student_getekend_op;
  const kanOndertekenen = !alGetekend && (contract.status === "klaar_voor_student" || !contract.status);

  return (
    <div className="page-inner">

      <div className="page-header">
        <h1>Stageovereenkomst</h1>
        <button className="btn sm" onClick={() => window.print()}>
          <IconPrinter size={14} /> Afdrukken / PDF
        </button>
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

      {/* Status */}
      <div className="card">
        <div className="card_title">
          <IconFileCheck size={16} />
          Status
        </div>
        <ContractBadge status={contract.status} />
      </div>

      {/* Stagegegevens */}
      <div className="card">
        <div className="card_title">
          <IconBuilding size={16} />
          Stagegegevens
        </div>
        <div className="kv"><span className="k">Student</span><span className="v">{contract.student_naam || "–"}</span></div>
        <div className="kv"><span className="k">Bedrijf</span><span className="v">{contract.bedrijf_naam || "–"}</span></div>
        <div className="kv"><span className="k">Mentor</span><span className="v">{contract.mentor_naam || "–"}</span></div>
        <div className="kv"><span className="k">Docent</span><span className="v">{contract.docent_naam || "–"}</span></div>
        <div className="kv"><span className="k">Startdatum</span><span className="v">{formatDatum(contract.startdatum)}</span></div>
        <div className="kv"><span className="k">Einddatum</span><span className="v">{formatDatum(contract.einddatum)}</span></div>
      </div>

      {/* Handtekeningen */}
      <div className="card">
        <div className="card_title">
          <IconWriting size={16} />
          Handtekeningen
        </div>
        <div className="partijen">
          <Partij titel="Student"          naam={contract.student_naam}  getekendOp={contract.student_getekend_op} />
          <Partij titel="Bedrijf / Mentor" naam={contract.mentor_naam}   getekendOp={contract.bedrijf_getekend_op} />
          <Partij titel="Opleiding"        naam={contract.docent_naam}   getekendOp={contract.opleiding_getekend_op} />
        </div>
      </div>

      {/* Ondertekenen */}
      {kanOndertekenen && (
        <div className="card">
          <div className="card_title">
            <IconWriting size={16} />
            Ondertekenen
          </div>
          <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 14, lineHeight: 1.6 }}>
            Door te ondertekenen bevestig je dat je de stageovereenkomst hebt gelezen en akkoord gaat met de inhoud ervan.
          </p>
          <label className="akkoord-label">
            <input type="checkbox" checked={akkoord} onChange={(e) => setAkkoord(e.target.checked)} />
            Ik ga akkoord met de stageovereenkomst
          </label>
          <div className="actions">
            <button className="btn primary" disabled={!akkoord || bezig} onClick={handleOndertekenen}>
              <IconWriting size={15} />
              {bezig ? "Bezig…" : "Digitaal ondertekenen"}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
