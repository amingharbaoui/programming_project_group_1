import { useState, useEffect, useRef } from "react";
import api, { apiRequest } from "../../../services/api";
import "./StudentDocumentsPage.css";
import {
  IconUpload,
  IconFile,
  IconCircleCheck,
  IconAlertCircle,
  IconEye,
  IconFolderOpen,
} from "@tabler/icons-react";

const STATUS_MAP = {
  ontbreekt:     ["s_rood",  "Ontbreekt"],
  ingediend:     ["s_blauw", "Ingediend"],
  in_controle:   ["s_amber", "In controle"],
  afgekeurd:     ["s_rood",  "Afgekeurd"],
  goedgekeurd:   ["s_ok",    "Goedgekeurd"],
  geregistreerd: ["s_ok",    "Geregistreerd"],
};

function StatusBadge({ status }) {
  const [cls, label] = STATUS_MAP[status] ?? ["s_grijs", status ?? "–"];
  return <span className={`status ${cls}`}>{label}</span>;
}

function formatDatum(d) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("nl-BE", { day: "2-digit", month: "short", year: "numeric" });
}

/* ── Verplicht document kaart ── */
function DocumentKaart({ soort, documenten, onUpload }) {
  const [bezig, setBezig] = useState(false);
  const inputRef = useRef(null);

  const actief = documenten?.[0] ?? null;

  async function handleBestandKiezen(e) {
    const bestand = e.target.files?.[0];
    if (!bestand) return;
    e.target.value = "";
    setBezig(true);
    try {
      const formData = new FormData();
      formData.append("document_soort_id", soort.id);
      formData.append("bestand", bestand);
      await api.post("/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onUpload();
    } catch (err) {
      alert(err.response?.data?.message || "Upload mislukt.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="doc-rij">
      <div className="doc-rij-links">
        <IconFile size={16} className="doc-file-icon" />
        <div>
          <div className="doc-naam">{soort.naam}</div>
          {actief && (
            <div className="doc-meta">
              Versie {actief.versie_nummer} · {formatDatum(actief.opgeladen_op)}
            </div>
          )}
          {actief?.afkeurreden && (
            <div className="doc-reden">
              <IconAlertCircle size={13} /> {actief.afkeurreden}
            </div>
          )}
        </div>
      </div>

      <div className="doc-rij-rechts">
        <StatusBadge status={actief?.status ?? "ontbreekt"} />

        {actief?.bestand_url && (
          <a href={actief.bestand_url} target="_blank" rel="noreferrer" className="btn sm">
            <IconEye size={14} /> Bekijken
          </a>
        )}

        <button className="btn sm primary" disabled={bezig} onClick={() => inputRef.current?.click()}>
          <IconUpload size={14} />
          {bezig ? "Bezig…" : actief ? "Nieuwe versie" : "Uploaden"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          style={{ display: "none" }}
          onChange={handleBestandKiezen}
        />
      </div>

    </div>
  );
}

/* ── Eigen document rij ── */
function EigenDocRij({ doc, onDelete }) {
  return (
    <div className="doc-rij">
      <div className="doc-rij-links">
        <IconFile size={16} className="doc-file-icon" />
        <div>
          <div className="doc-naam">{doc.bestand_naam}</div>
          <div className="doc-meta">{formatDatum(doc.opgeladen_op)}</div>
        </div>
      </div>
      <div className="doc-rij-rechts">
        <StatusBadge status={doc.status} />
        {doc.bestand_url && (
          <a href={doc.bestand_url} target="_blank" rel="noreferrer" className="btn sm">
            <IconEye size={14} /> Bekijken
          </a>
        )}
      </div>
    </div>
  );
}

/* ── Hoofd component ── */
export default function StudentDocumentsPage() {
  const [documenten, setDocumenten] = useState([]);
  const [soorten, setSoorten]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [fout, setFout]             = useState(null);
  const [eigenBezig, setEigenBezig] = useState(false);
  const eigenInputRef = useRef(null);

  useEffect(() => { laadData(); }, []);

  async function laadData() {
    setLoading(true);
    setFout(null);
    try {
      const [docsRes, soortenRes] = await Promise.all([
        apiRequest("GET", "/documents/my"),
        apiRequest("GET", "/documents/soorten").catch(() => ({ data: [] })),
      ]);
      setDocumenten(docsRes.data ?? []);
      setSoorten(soortenRes.data ?? []);
    } catch (err) {
      setFout(err.response?.data?.message || "Documenten konden niet geladen worden.");
    } finally {
      setLoading(false);
    }
  }

  function groeperPerSoort(soortId) {
    return documenten
      .filter((d) => d.document_soort_id === soortId)
      .sort((a, b) => b.versie_nummer - a.versie_nummer);
  }

  // Eigen documenten: geen document_soort_id
  const eigenDocs = documenten.filter((d) => !d.document_soort_id);

  async function handleEigenUpload(e) {
    const bestand = e.target.files?.[0];
    if (!bestand) return;
    e.target.value = "";
    setEigenBezig(true);
    try {
      const formData = new FormData();
      formData.append("bestand", bestand);
      await api.post("/documents/upload-eigen", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await laadData();
    } catch (err) {
      alert(err.response?.data?.message || "Upload mislukt.");
    } finally {
      setEigenBezig(false);
    }
  }

  if (loading) {
    return (
      <div className="page-inner">
        <div className="page-header"><h1>Mijn documenten</h1></div>
        <div className="card"><p>Laden…</p></div>
      </div>
    );
  }

  return (
    <div className="page-inner">

      <div className="page-header">
        <h1>Mijn documenten</h1>
        <p>Upload hier de verplichte documenten voor je stage.</p>
      </div>

      {fout && (
        <div className="card">
          <span className="status s_rood"><IconAlertCircle size={14} /> {fout}</span>
        </div>
      )}

      {/* Verplichte documenten */}
      <div className="card">
        <div className="card_title">
          <IconFile size={16} />
          Verplichte documenten
        </div>

        {soorten.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--sub)" }}>Geen verplichte documenten gevonden.</p>
        ) : (
          <div className="doc-lijst">
            {soorten.map((soort) => (
              <DocumentKaart
                key={soort.id}
                soort={soort}
                documenten={groeperPerSoort(soort.id)}
                onUpload={laadData}
              />
            ))}
          </div>
        )}
      </div>

      {/* Eigen documenten */}
      <div className="card">
        <div className="card_title">
          <IconFolderOpen size={16} />
          Eigen documenten
        </div>
        {eigenDocs.length > 0 && (
          <div className="doc-lijst" style={{ marginBottom: 14 }}>
            {eigenDocs.map((doc) => (
              <EigenDocRij key={doc.id} doc={doc} onDelete={laadData} />
            ))}
          </div>
        )}

        <div
          className="dropzone"
          onClick={() => !eigenBezig && eigenInputRef.current?.click()}
          style={{ cursor: eigenBezig ? "not-allowed" : "pointer", opacity: eigenBezig ? .6 : 1 }}
        >
          <i className="ti ti-upload"></i>
          <div className="dz-t">{eigenBezig ? "Bezig met uploaden…" : "Document toevoegen"}</div>
          {!eigenBezig && <div className="dz-s">pdf, docx, png, jpg</div>}
        </div>
        <input
          ref={eigenInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          style={{ display: "none" }}
          onChange={handleEigenUpload}
        />
      </div>

    </div>
  );
}
