import { useState, useEffect } from "react";
import { apiRequest } from "../../../services/api";
import "./StudentContractPage.css";
import {
  IconFileCheck,
  IconUser,
  IconBuilding,
  IconSchool,
  IconCalendar,
  IconShieldCheck,
  IconWriting,
  IconCircleCheck,
  IconClock,
  IconAlertCircle,
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

function HandtekeningBadge({ getekendOp }) {
  if (getekendOp) {
    return (
      <span className="handtekening-badge getekend">
        <IconCircleCheck size={14} />
        Ondertekend op {formatDatumTijd(getekendOp)}
      </span>
    );
  }
  return (
    <span className="handtekening-badge wacht">
      <IconClock size={14} />
      Wacht op ondertekening
    </span>
  );
}

const STATUS_MAP = {
  klaar_voor_student:            ["badge-blauw", "Klaar voor ondertekening"],
  getekend_door_student:         ["badge-groen", "Getekend door jou"],
  wacht_op_bedrijf:              ["badge-geel",  "Wacht op bedrijf"],
  volledig_ondertekend:          ["badge-groen", "Volledig ondertekend"],
  in_controle_bij_administratie: ["badge-blauw", "Bij administratie"],
  afgekeurd:                     ["badge-rood",  "Afgekeurd"],
  geregistreerd:                 ["badge-groen", "Geregistreerd"],
};

function ContractBadge({ status }) {
  const [cls, label] = STATUS_MAP[status] ?? ["badge-grijs", status ?? "Onbekend"];
  return <span className={`contract-badge ${cls}`}>{label}</span>;
}

function Rij({ icon: Icon, label, waarde }) {
  return (
    <div className="gegevens-rij">
      <span className="gegevens-label">
        <Icon size={15} className="gegevens-icon" />
        {label}
      </span>
      <span className="gegevens-waarde">{waarde || "–"}</span>
    </div>
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
      setSuccesmelding(`Ondertekend op ${formatDatumTijd(res.data.getekendOp)}`);
      await laadContract();
      setAkkoord(false);
    } catch (err) {
      setFout(err.response?.data?.message || "Ondertekenen mislukt.");
    } finally {
      setBezig(false);
    }
  }

  if (loading) {
    return <div className="contract-page"><div className="laadbericht">Stageovereenkomst laden…</div></div>;
  }

  if (!contract) {
    return (
      <div className="contract-page">
        <div className="geen-contract">
          <IconFileCheck size={40} />
          <p>Er is nog geen stageovereenkomst beschikbaar.</p>
        </div>
      </div>
    );
  }

  const alGetekend   = !!contract.student_getekend_op;
  const kanOndertekenen = !alGetekend && (contract.status === "klaar_voor_student" || !contract.status);

  return (
    <div className="contract-page">

      {fout && (
        <div className="melding melding-fout">
          <IconAlertCircle size={16} /> {fout}
        </div>
      )}

      {succesmelding && (
        <div className="melding melding-ok">
          <IconCircleCheck size={16} /> {succesmelding}
        </div>
      )}

      <div className="contract-header">
        <div>
          <h2 className="contract-dossiernr">Dossier {contract.dossiernummer}</h2>
          <p className="contract-subtitel">Stageovereenkomst</p>
        </div>
        <ContractBadge status={contract.status} />
      </div>

      <div className="kaart">
        <h3 className="kaart-titel">Stagegegevens</h3>
        <div className="gegevens-lijst">
          <Rij icon={IconUser}        label="Student"    waarde={contract.student_naam} />
          <Rij icon={IconBuilding}    label="Bedrijf"    waarde={contract.bedrijf_naam} />
          <Rij icon={IconUser}        label="Mentor"     waarde={contract.mentor_naam} />
          <Rij icon={IconSchool}      label="Docent"     waarde={contract.docent_naam} />
          <Rij icon={IconCalendar}    label="Startdatum" waarde={formatDatum(contract.startdatum)} />
          <Rij icon={IconCalendar}    label="Einddatum"  waarde={formatDatum(contract.einddatum)} />
          <Rij icon={IconShieldCheck} label="Verzekering" waarde={contract.verzekering ?? "Op te laden"} />
        </div>
      </div>

      <div className="kaart">
        <h3 className="kaart-titel">Handtekeningen</h3>
        <div className="partijen">
          <Partij titel="Student"          naam={contract.student_naam} getekendOp={contract.student_getekend_op} />
          <Partij titel="Bedrijf / Mentor" naam={contract.mentor_naam} getekendOp={contract.bedrijf_getekend_op} />
          <Partij titel="Opleiding"        naam={contract.docent_naam} getekendOp={contract.opleiding_getekend_op} />
        </div>
      </div>

      {kanOndertekenen && (
        <div className="kaart kaart-ondertekenen">
          <h3 className="kaart-titel">
            <IconWriting size={17} /> Ondertekenen
          </h3>
          <p className="ondertekenen-tekst">
            Door te ondertekenen bevestig je dat je de stageovereenkomst hebt gelezen en akkoord gaat met de inhoud ervan.
          </p>
          <label className="akkoord-label">
            <input type="checkbox" checked={akkoord} onChange={(e) => setAkkoord(e.target.checked)} />
            Ik ga akkoord met de stageovereenkomst
          </label>
          <button className="btn-ondertekenen" disabled={!akkoord || bezig} onClick={handleOndertekenen}>
            {bezig ? "Bezig…" : "Digitaal ondertekenen"}
          </button>
        </div>
      )}

      {alGetekend && (
        <div className="kaart kaart-getekend">
          <IconCircleCheck size={20} className="getekend-icon" />
          <span>
            Je hebt de stageovereenkomst ondertekend op{" "}
            <strong>{formatDatumTijd(contract.student_getekend_op)}</strong>.
          </span>
        </div>
      )}

    </div>
  );
}
