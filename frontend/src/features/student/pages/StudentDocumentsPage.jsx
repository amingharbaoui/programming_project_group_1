import { useState, useEffect, useRef } from "react";
import api, { apiRequest } from "../../../services/api";
import "./StudentDocumentsPage.css";
import {
  IconUpload,
  IconFile,
  IconCircleCheck,
  IconAlertCircle,
  IconEye,
  IconHistory,
} from "@tabler/icons-react";

const STATUS_MAP = {
  ontbreekt:    ["badge-rood",  "Ontbreekt"],
  ingediend:    ["badge-blauw", "Ingediend · in controle"],
  in_controle:  ["badge-geel",  "In controle"],
  afgekeurd:    ["badge-rood",  "Afgekeurd"],
  goedgekeurd:  ["badge-groen", "Goedgekeurd"],
  geregistreerd:["badge-groen", "Geregistreerd"],
};

function StatusBadge({ status }) {
  const [cls, label] = STATUS_MAP[status] ?? ["badge-grijs", status ?? "–"];
  return <span className={`doc-badge ${cls}`}>{label}</span>;
}

function formatDatum(d) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("nl-BE", { day: "2-digit", month: "short", year: "numeric" });
}

function DocumentKaart({ soort, documenten, onUpload }) {
  const [bezig, setBezig]           = useState(false);
  const [historiekOpen, setHistoriekOpen] = useState(false);
  const inputRef = useRef(null);

  const actief    = documenten?.[0] ?? null;
  const historiek = documenten?.slice(1) ?? [];

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
    <div className="doc-kaart">
      <div className="doc-kaart-header">
        <div className="doc-kaart-info">
          <IconFile size={18} className="doc-file-icon" />
          <div>
            <div className="doc-soort-naam">{soort.naam}</div>
            {actief && (
              <div className="doc-versie">
                Versie {actief.versie_nummer} · {formatDatum(actief.opgeladen_op)}
              </div>
            )}
          </div>
        </div>
        <div className="doc-kaart-rechts">
          <StatusBadge status={actief?.status ?? "ontbreekt"} />

          {actief?.bestand_url && (
            <a href={actief.bestand_url} target="_blank" rel="noreferrer" className="doc-btn doc-btn-bekijken">
              <IconEye size={15} /> Bekijken
            </a>
          )}

          <button className="doc-btn doc-btn-upload" disabled={bezig} onClick={() => inputRef.current?.click()}>
            <IconUpload size={15} />
            {bezig ? "Bezig…" : actief ? "Nieuwe versie" : "Uploaden"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="doc-file-input"
            onChange={handleBestandKiezen}
          />
        </div>
      </div>

      {actief?.afkeurreden && (
        <div className="doc-reden">
          <IconAlertCircle size={14} /> {actief.afkeurreden}
        </div>
      )}

      {historiek.length > 0 && (
        <div className="doc-historiek">
          <button className="doc-historiek-toggle" onClick={() => setHistoriekOpen((o) => !o)}>
            <IconHistory size={13} />
            {historiekOpen ? "Historiek verbergen" : `${historiek.length} eerdere versie(s)`}
          </button>
          {historiekOpen && (
            <div className="doc-historiek-lijst">
              {historiek.map((d) => (
                <div key={d.id} className="doc-historiek-rij">
                  <span>v{d.versie_nummer} · {formatDatum(d.opgeladen_op)}</span>
                  <StatusBadge status={d.status} />
                  {d.bestand_url && (
                    <a href={d.bestand_url} target="_blank" rel="noreferrer" className="doc-link">Bekijken</a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function StudentDocumentsPage() {
  const [documenten, setDocumenten] = useState([]);
  const [soorten, setSoorten]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [fout, setFout]             = useState(null);

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

  if (loading) {
    return <div className="docs-page"><div className="laadbericht">Documenten laden…</div></div>;
  }

  return (
    <div className="docs-page">

      {fout && (
        <div className="melding melding-fout">
          <IconAlertCircle size={16} /> {fout}
        </div>
      )}

      <div className="docs-header">
        <h2 className="docs-titel">Mijn documenten</h2>
        <p className="docs-subtitel">Upload hier de verplichte documenten voor je stage.</p>
      </div>

      <div className="docs-lijst">
        {soorten.length === 0 && documenten.length === 0 && (
          <div className="laadbericht">Geen documenten gevonden.</div>
        )}
        {soorten.map((soort) => (
          <DocumentKaart
            key={soort.id}
            soort={soort}
            documenten={groeperPerSoort(soort.id)}
            onUpload={laadData}
          />
        ))}
        {/* Toon documenten van soorten die niet in de lijst staan */}
        {documenten
          .filter((d) => !soorten.find((s) => s.id === d.document_soort_id))
          .reduce((acc, d) => {
            if (!acc.find((s) => s.id === d.document_soort_id)) {
              acc.push({ id: d.document_soort_id, naam: d.soort_naam, type: d.soort_type });
            }
            return acc;
          }, [])
          .map((soort) => (
            <DocumentKaart
              key={soort.id}
              soort={soort}
              documenten={groeperPerSoort(soort.id)}
              onUpload={laadData}
            />
          ))}
      </div>

    </div>
  );
}
