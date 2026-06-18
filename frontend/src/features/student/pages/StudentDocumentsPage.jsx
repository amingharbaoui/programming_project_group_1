import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api, { apiRequest, fileUrl } from "../../../services/api";
import "./StudentDocumentsPage.css";
import Modal from "../../../components/ui/Modal";
import {
  IconUpload,
  IconFile,
  IconAlertCircle,
  IconEye,
  IconFolderOpen,
  IconArrowRight,
} from "@tabler/icons-react";

const STATUS_MAP = {
  ontbreekt:     ["s_rood",  "Ontbreekt"],
  ingediend:     ["s_blauw", "Ingediend"],
  in_controle:   ["s_amber", "In controle"],
  afgekeurd:     ["s_rood",  "Afgekeurd"],
  goedgekeurd:   ["s_ok",    "Goedgekeurd"],
  geregistreerd: ["s_ok",    "Geregistreerd"],
};
const CONTRACT_GEREGISTREERD = ["startklaar", "gestart", "lopend", "presentatie", "afgerond", "geregistreerd"];

function StatusBadge({ status }) {
  const [cls, label] = STATUS_MAP[status] ?? ["s_grijs", status ?? "–"];
  return <span className={`status ${cls}`}>{label}</span>;
}

function formatDatum(d) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("nl-BE", { day: "2-digit", month: "short", year: "numeric" });
}

function isAfbeelding(url) {
  return /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url ?? "");
}

// Bouwt de bekijk-URL via de centrale helper (geeft het sessietoken als ?t= mee zodat
// de nu-beveiligde bestand-route het toelaat). Gaat via de Vite-proxy (/api).
function bestandSrc(url) {
  return fileUrl(url);
}

function deadlineVoorDocument(soort, documenten, contract) {
  if (soort.type === "stageovereenkomst") {
    return CONTRACT_GEREGISTREERD.includes(contract?.status) ? "" : "vóór de start";
  }

  const actief = documenten?.[0];
  return ["goedgekeurd", "geregistreerd"].includes(actief?.status) ? "" : "tegen start";
}

/* ── Verplicht document kaart ── */
function DocumentKaart({ soort, documenten, onUpload, onFout, onBekijken }) {
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
      await api.post("/documents/upload", formData);
      onUpload();
    } catch (err) {
      onFout(err.response?.data?.message || "Upload mislukt. Probeer opnieuw.");
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
              {formatDatum(actief.opgeladen_op)}
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
          <button className="btn sm" onClick={() => onBekijken(actief.bestand_url, soort.naam)}>
            <IconEye size={14} /> Bekijken
          </button>
        )}

        <button className="btn sm primary" disabled={bezig} onClick={() => inputRef.current?.click()}>
          <IconUpload size={14} />
          {bezig ? "Bezig…" : actief ? "Nieuwe versie" : "Uploaden"}
        </button>
        <input
          ref={inputRef}
          type="file"
          name="bestand"
          accept=".pdf,.png,.jpg,.jpeg"
          style={{ display: "none" }}
          onChange={handleBestandKiezen}
        />
      </div>

    </div>
  );
}

/* ── Stageovereenkomst rij (niet uploadbaar, link naar contract pagina) ── */
function OvereenkomstRij({ contract, navigate }) {
  const status = !contract
    ? "ontbreekt"
    : CONTRACT_GEREGISTREERD.includes(contract.status)
    ? "geregistreerd"
    : ["volledig_ondertekend","in_controle_bij_administratie","validatie"].includes(contract.status)
    ? "in_controle"
    : contract.student_getekend_op
    ? "ingediend"
    : "ontbreekt";

  const meta = !contract
    ? "Digitaal te ondertekenen — regelt je verzekering"
    : CONTRACT_GEREGISTREERD.includes(contract.status)
    ? "Geregistreerd door de administratie"
    : ["volledig_ondertekend","in_controle_bij_administratie","validatie"].includes(contract.status)
    ? "Volledig ondertekend — in controle bij administratie"
    : contract.student_getekend_op
    ? "Jij tekende — wacht op het bedrijf"
    : "Digitaal te ondertekenen — regelt je verzekering";

  return (
    <div className="doc-rij">
      <div className="doc-rij-links">
        <i className="ti ti-file-certificate" style={{ fontSize: 16, color: "var(--sub)", flexShrink: 0 }}></i>
        <div>
          <div className="doc-naam">Stageovereenkomst</div>
          <div className="doc-meta">{meta}</div>
        </div>
      </div>
      <div className="doc-rij-rechts">
        <StatusBadge status={status} />
        <button className="btn sm" onClick={() => navigate("/student/contract")}>
          {CONTRACT_GEREGISTREERD.includes(contract?.status) ? "Bekijk" : "Ga naar"}
          <IconArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}

/* ── Eigen document rij ── */
function EigenDocRij({ doc, onBekijken }) {
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
          <button className="btn sm" onClick={() => onBekijken(doc.bestand_url, doc.bestand_naam)}>
            <IconEye size={14} /> Bekijken
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Hoofd component ── */
export default function StudentDocumentsPage() {
  const navigate = useNavigate();
  const [documenten, setDocumenten] = useState([]);
  const [soorten, setSoorten]       = useState([]);
  const [contractData, setContractData] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [fout, setFout]             = useState(null);
  const [uploadFout, setUploadFout] = useState(null);
  const [preview, setPreview] = useState(null); // { url, naam }
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
      // Reflectiebijlage en Eindoverzicht niet tonen (automatisch/niet van toepassing)
      const VERBERG = new Set(["reflectiebijlage", "eindoverzicht"]);
      setSoorten((soortenRes.data ?? []).filter((s) => !VERBERG.has(s.type) && !VERBERG.has(s.naam?.toLowerCase())));
    } catch (err) {
      setFout(err.response?.data?.message || "Documenten konden niet geladen worden.");
    } finally {
      setLoading(false);
    }
    // Contract status ophalen voor de Stageovereenkomst rij
    try {
      const res = await apiRequest("GET", "/contracts/my");
      setContractData(res.data ?? null);
    } catch {
      setContractData(null);
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
      setUploadFout(err.response?.data?.message || "Upload mislukt. Probeer opnieuw.");
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
    <>
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

      {/* Amber banner: ontbrekende verplichte docs */}
      {(() => {
        const uploadSoorten = soorten.filter(s => s.type !== "stageovereenkomst");
        const ontbreekt = uploadSoorten.filter(s => {
          const actief = groeperPerSoort(s.id)[0];
          return !actief || ["ontbreekt", "afgekeurd"].includes(actief.status);
        }).length;
        if (!ontbreekt) return null;
        return (
          <div className="banner amber" style={{ padding: "10px 14px" }}>
            <i className="ti ti-alert-circle"></i>
            <div>
              <div className="b-title" style={{ fontSize: 13 }}>
                Nog {ontbreekt} verplicht{ontbreekt > 1 ? "e documenten" : " document"} in orde te brengen
              </div>
            </div>
          </div>
        );
      })()}

      {/* Verplichte documenten */}
      <section className="docs-section">
        <div className="card_title docs-section-title">
          <i className="ti ti-file" style={{ fontSize: 16 }}></i>
          Verplichte documenten
        </div>

        {soorten.length === 0 ? (
          <div className="card"><p style={{ fontSize: 13, color: "var(--sub)" }}>Geen verplichte documenten gevonden.</p></div>
        ) : (
          <div className="doc-verplicht-lijst">
            {soorten.map((soort) => {
              const docsVoorSoort = groeperPerSoort(soort.id);
              const deadline = deadlineVoorDocument(soort, docsVoorSoort, contractData);

              return (
                <div className="doc-verplicht-item" key={soort.id}>
                  <div className="doc-verplicht-card">
                    {soort.type === "stageovereenkomst" ? (
                      <OvereenkomstRij contract={contractData} navigate={navigate} />
                    ) : (
                      <DocumentKaart
                        soort={soort}
                        documenten={docsVoorSoort}
                        onUpload={laadData}
                        onFout={setUploadFout}
                        onBekijken={(url, naam) => setPreview({ url, naam })}
                      />
                    )}
                  </div>
                  <div className="doc-deadline">
                    {deadline && (
                      <>
                        <i className="ti ti-clock"></i>
                        <span>{deadline}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Eigen documenten */}
      <div className="card">
        <div className="card_title">
          <IconFolderOpen size={16} />
          Eigen documenten
        </div>
        {eigenDocs.length > 0 && (
          <div className="doc-lijst" style={{ marginBottom: 14 }}>
            {eigenDocs.map((doc) => (
              <EigenDocRij key={doc.id} doc={doc} onBekijken={(url, naam) => setPreview({ url, naam })} />
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
          name="eigenBestand"
          accept=".pdf,.png,.jpg,.jpeg"
          style={{ display: "none" }}
          onChange={handleEigenUpload}
        />
      </div>

    </div>

    {/* Preview-modal */}
    <Modal
      wide
      open={!!preview}
      onClose={() => setPreview(null)}
      icon="ti-eye"
      titel={preview?.naam ?? "Document"}
      footer={
        <a
          href={bestandSrc(preview?.url)}
          target="_blank"
          rel="noreferrer"
          className="btn"
          style={{ marginRight: "auto" }}
        >
          <i className="ti ti-external-link"></i> Openen in nieuw tabblad
        </a>
      }
    >
      {preview && (
        isAfbeelding(preview.url) ? (
          <img
            src={bestandSrc(preview.url)}
            alt={preview.naam}
            style={{ maxWidth: "100%", display: "block", borderRadius: 6 }}
          />
        ) : (
          <iframe
            src={bestandSrc(preview.url)}
            title={preview.naam}
            style={{ width: "100%", height: "65vh", border: "none", borderRadius: 6 }}
          />
        )
      )}
    </Modal>

    {/* Fout-modal bij mislukte upload */}
    <Modal
      open={!!uploadFout}
      onClose={() => setUploadFout(null)}
      icon="ti-alert-circle"
      titel="Upload mislukt"
      sub={uploadFout}
      footer={
        <button className="btn primary" onClick={() => setUploadFout(null)}>
          <i className="ti ti-check"></i> Begrepen
        </button>
      }
    />
    </>
  );
}
