import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./DossierDetailPage.css";
import "../../../index.css";
import api, { fileUrl } from "../../../services/api";
import {
  IconArrowLeft,
  IconFolder,
  IconFileCertificate,
  IconChecklist,
  IconRubberStamp,
  IconMailForward,
  IconFileExport,
  IconCheck,
  IconX,
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconFileText,
  IconFileTypePdf,
  IconEye,
  IconWalk,
  IconUsers,
  IconAlertTriangle,
  IconFileOff,
} from "@tabler/icons-react";

/* ─── Real DB status values (schema.sql line 312) ─── */
const STATUS_CONFIG = {
  wacht_op_student:              { cls: "s_amber", label: "Wacht op student" },
  wacht_op_bedrijf:              { cls: "s_amber", label: "Wacht op stagebedrijf" },
  in_controle_bij_administratie: { cls: "s_amber", label: "In controle" },
  document_afgekeurd:            { cls: "s_red",   label: "Wacht op nieuwe versie" },
  geregistreerd:                 { cls: "s_ok",    label: "Geregistreerd" },
  stage_loopt:                   { cls: "s_info",  label: "Stage loopt" },
  resultaat_vrijgegeven:         { cls: "s_amber", label: "Eindoverzicht te genereren" },
  afgerond:                      { cls: "s_ok",    label: "Afgerond" },
};

const CONTRACT_STATES  = ["wacht_op_student", "wacht_op_bedrijf", "in_controle_bij_administratie", "document_afgekeurd", "geregistreerd"];
const AFSLUITING_STATES = ["resultaat_vrijgegeven", "afgerond"];

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" });
}

function fmtDateShort(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("nl-BE", { day: "numeric", month: "long" });
}

function initials(voornaam, achternaam) {
  return [voornaam, achternaam].filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "ST";
}

function Steps({ status }) {
  const isAfsluiting = AFSLUITING_STATES.includes(status) || status === "stage_loopt";

  let fases, activeIdx, subs;

  if (isAfsluiting) {
    fases = ["Geregistreerd", "Stage loopt", "Evaluatie", "Resultaat", "Eindoverzicht"];
    activeIdx = status === "stage_loopt" ? 1
      : status === "resultaat_vrijgegeven" ? 4
      : 5;
    subs = status === "stage_loopt"
      ? ["Voltooid", "Actief", "—", "—", "—"]
      : status === "resultaat_vrijgegeven"
      ? ["Voltooid", "Voltooid", "Voltooid", "Vrijgegeven", "Te genereren"]
      : ["Voltooid", "Voltooid", "Voltooid", "Vrijgegeven", "Gegenereerd"];
  } else {
    fases = ["Voorstel", "Toewijzing", "Stageovereenkomst", "Documenten", "Geregistreerd"];
    const idxMap = {
      wacht_op_student:              2,
      wacht_op_bedrijf:              2,
      in_controle_bij_administratie: 3,
      document_afgekeurd:            3,
      geregistreerd:                 5,
    };
    activeIdx = idxMap[status] ?? 0;
    const subsMap = {
      wacht_op_student:              ["Goedgekeurd", "Definitief gekoppeld", "Wacht op student",  "—",               "—"],
      wacht_op_bedrijf:              ["Goedgekeurd", "Definitief gekoppeld", "Wacht op bedrijf",  "—",               "—"],
      in_controle_bij_administratie: ["Goedgekeurd", "Definitief gekoppeld", "Ondertekend",       "Te controleren",  "—"],
      document_afgekeurd:            ["Goedgekeurd", "Definitief gekoppeld", "Afgekeurd",         "Wacht op versie", "—"],
      geregistreerd:                 ["Goedgekeurd", "Definitief gekoppeld", "Geregistreerd",     "Compleet",        "Startklaar"],
    };
    subs = subsMap[status] || ["—", "—", "—", "—", "—"];
  }

  return (
    <div className="card dd_steps_card">
      <div className="steps">
        {fases.map((fase, i) => {
          const cls = i < activeIdx ? "done" : i === activeIdx ? "active" : "";
          let vul = 0;
          if (i + 1 < activeIdx) vul = 100;
          else if (i + 1 === activeIdx) vul = 50;
          return (
            <div key={fase} className={`step${cls ? ` ${cls}` : ""}`}>
              <div className="step-block">
                <div className="step-circle">
                  {i < activeIdx ? <IconCheck size={17} /> : i + 1}
                </div>
                <div className="step-col">
                  <span className="step-label">{fase}</span>
                  <span className="step-sub">{subs[i] || "—"}</span>
                </div>
              </div>
              {i < fases.length - 1 && (
                <div className="step-line">
                  <span className="fill" style={{ width: `${vul}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Banner({ type, icon: Icon, title, text, children }) {
  return (
    <div className={`dd_banner dd_banner_${type}`}>
      <Icon size={18} stroke={2} className="dd_banner_icon" />
      <div className="dd_banner_body">
        <div className="dd_banner_title">{title}</div>
        {text && <div className="dd_banner_text">{text}</div>}
        {children}
      </div>
    </div>
  );
}

function OvkRow({ icon: Icon, color, label, date }) {
  return (
    <div className="dd_dl_row">
      <Icon size={16} stroke={1.8} style={{ color, flexShrink: 0 }} />
      <span className="dd_dl_name">{label}</span>
      <span className="dd_dl_date">{date || ""}</span>
    </div>
  );
}

export default function DossierDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [dossier, setDossier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  /* modals */
  const [modal, setModal] = useState(null); // null | 'registreren' | 'afkeuren' | 'eindoverzicht' | 'herinnering'
  const [afkeurReden, setAfkeurReden] = useState("");
  const [afkeurError, setAfkeurError] = useState("");

  /* document-level approve/reject */
  const [docModal, setDocModal] = useState(null); // null | { id, naam }

  /* PDF preview */
  const [preview, setPreview] = useState(null); // null | { naam, url }
  const [iframeErr, setIframeErr] = useState(false);
  function openPreview(url, naam) { if (url) setPreview({ naam, url }); }
  const [docReden, setDocReden] = useState("");
  const [docRedenError, setDocRedenError] = useState("");

  const showToast = useCallback((msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get(`/admin/dossiers/${id}`);
      setDossier(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Dossier ophalen mislukt");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="page">
        <div className="dd_loading">Dossier laden…</div>
      </div>
    );
  }

  if (error || !dossier) {
    return (
      <div className="page">
        <button className="dd_back" onClick={() => navigate("/admin/dossiers")}>
          <IconArrowLeft size={15} stroke={2.2} /> Terug naar dossiers
        </button>
        <div className="dd_error">{error || "Dossier niet gevonden."}</div>
      </div>
    );
  }

  const status = dossier.status;
  const statusCfg = STATUS_CONFIG[status] || { cls: "s_gray", label: status };
  const isContract  = CONTRACT_STATES.includes(status);
  const isLoopt     = status === "stage_loopt";
  const isAfsluiting = AFSLUITING_STATES.includes(status);
  const isControleer = status === "in_controle_bij_administratie";
  const isGeregistreerd = ["geregistreerd", "stage_loopt", "resultaat_vrijgegeven", "afgerond"].includes(status);

  const student = `${dossier.student_voornaam || ""} ${dossier.student_achternaam || ""}`.trim();
  const docent  = `${dossier.docent_voornaam || ""} ${dossier.docent_achternaam || ""}`.trim();
  const mentor  = `${dossier.mentor_voornaam || ""} ${dossier.mentor_achternaam || ""}`.trim();
  const ini = initials(dossier.student_voornaam, dossier.student_achternaam);
  const ovk = dossier.stageovereenkomst;

  /* ─── Actions ─── */
  async function doRegistreer() {
    setActionLoading(true);
    try {
      await api.patch(`/admin/dossiers/${id}/startklaar`);
      showToast("Stageovereenkomst geregistreerd — dossier compleet en startklaar.");
      setModal(null);
      load();
    } catch (err) {
      showToast(err.response?.data?.message || "Registratie mislukt", "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function doAfkeuren() {
    if (!afkeurReden.trim()) {
      setAfkeurError("Reden is verplicht.");
      return;
    }
    setActionLoading(true);
    try {
      await api.patch(`/admin/dossiers/${id}/status`, {
        status: "document_afgekeurd",
        afkeurReden: afkeurReden.trim(),
      });
      showToast("Document afgekeurd — de student kan een nieuwe versie opladen.");
      setModal(null);
      setAfkeurReden("");
      setAfkeurError("");
      load();
    } catch (err) {
      showToast(err.response?.data?.message || "Afkeuren mislukt", "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function doHerinnering() {
    setActionLoading(true);
    try {
      await api.post(`/admin/dossiers/${id}/reminder`);
      showToast("Herinnering verstuurd.");
      setModal(null);
      load();
    } catch (err) {
      showToast(err.response?.data?.message || "Herinnering versturen mislukt", "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function doEindoverzicht() {
    setActionLoading(true);
    try {
      await api.post(`/admin/dossiers/${id}/eindoverzicht`);
      showToast("Eindoverzicht gegenereerd — beschikbaar voor student en stagebegeleider.");
      setModal(null);
      load();
    } catch (err) {
      showToast(err.response?.data?.message || "Eindoverzicht genereren mislukt", "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function doApproveDoc(docId) {
    setActionLoading(true);
    try {
      await api.patch(`/admin/documents/${docId}/approve`);
      showToast("Document goedgekeurd.");
      load();
    } catch (err) {
      showToast(err.response?.data?.message || "Goedkeuren mislukt", "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function doRejectDoc() {
    if (!docReden.trim()) { setDocRedenError("Reden is verplicht."); return; }
    setActionLoading(true);
    try {
      await api.patch(`/admin/documents/${docModal.id}/reject`, { reden: docReden.trim() });
      showToast("Document afgekeurd.");
      setDocModal(null);
      setDocReden("");
      setDocRedenError("");
      load();
    } catch (err) {
      showToast(err.response?.data?.message || "Afkeuren mislukt", "error");
    } finally {
      setActionLoading(false);
    }
  }

  /* ─── Dossier info card ─── */
  function DossierKaart() {
    return (
      <div className="card dd_card">
        <div className="dd_card_title">
          <IconFolder size={16} stroke={1.8} />
          Stagedossier {dossier.dossiernummer || "—"}
        </div>

        {/* Student */}
        <div className="kv">
          <span className="k">Student</span>
          <span className="v">
            {student}
            {dossier.studentennummer && <span className="dd_muted"> · {dossier.studentennummer}</span>}
          </span>
        </div>
        {dossier.student_email && (
          <div className="kv"><span className="k">E-mail student</span><span className="v">{dossier.student_email}</span></div>
        )}
        <div className="kv">
          <span className="k">Opleiding</span>
          <span className="v">
            {dossier.opleiding || "—"}
            {dossier.academiejaar && <span className="dd_muted"> · {dossier.academiejaar}</span>}
          </span>
        </div>

        {/* Bedrijf */}
        <div className="kv">
          <span className="k">Stagebedrijf</span>
          <span className="v">
            {dossier.bedrijf_naam || "—"}
            {dossier.bedrijf_afdeling && <span className="dd_muted"> · {dossier.bedrijf_afdeling}</span>}
          </span>
        </div>
        {(dossier.bedrijf_adres || dossier.bedrijf_stad) && (
          <div className="kv">
            <span className="k">Adres</span>
            <span className="v">
              {[dossier.bedrijf_adres, dossier.bedrijf_postcode, dossier.bedrijf_stad].filter(Boolean).join(", ")}
            </span>
          </div>
        )}
        {dossier.bedrijf_email && (
          <div className="kv"><span className="k">E-mail bedrijf</span><span className="v">{dossier.bedrijf_email}</span></div>
        )}
        {dossier.bedrijf_telefoon && (
          <div className="kv"><span className="k">Tel. bedrijf</span><span className="v">{dossier.bedrijf_telefoon}</span></div>
        )}

        {/* Mentor & begeleider */}
        {mentor && (
          <div className="kv">
            <span className="k">Stagementor</span>
            <span className="v">
              {mentor}
              {dossier.mentor_email && <span className="dd_muted"> · {dossier.mentor_email}</span>}
            </span>
          </div>
        )}
        <div className="kv">
          <span className="k">Stagebegeleider</span>
          <span className="v">
            {docent || "—"}
            {docent && <span className="dd_muted"> · definitief gekoppeld</span>}
            {dossier.docent_email && <span className="dd_muted"> · {dossier.docent_email}</span>}
          </span>
        </div>

        {/* Periode */}
        {(dossier.startdatum || dossier.einddatum) && (
          <div className="kv">
            <span className="k">Periode</span>
            <span className="v">
              {fmtDate(dossier.startdatum) || "—"} – {fmtDate(dossier.einddatum) || "—"}
              {dossier.aantal_weken && <span className="dd_muted"> · {dossier.aantal_weken} weken</span>}
              {dossier.uren_per_week && <span className="dd_muted"> · {dossier.uren_per_week}u/week</span>}
              {dossier.totaal_uren && <span className="dd_muted"> ({dossier.totaal_uren}u totaal)</span>}
            </span>
          </div>
        )}

        {/* Praktische afspraken */}
        {dossier.praktische_afspraken && (
          <div className="kv">
            <span className="k">Praktische afspraken</span>
            <span className="v">
              {dossier.praktische_afspraken}
              {dossier.praktische_afspraken_gedeeld_op && (
                <span className="dd_muted"> · gedeeld op {fmtDateShort(dossier.praktische_afspraken_gedeeld_op)}</span>
              )}
            </span>
          </div>
        )}

        {/* Status & verzekering */}
        <div className="kv">
          <span className="k">Dossierstatus</span>
          <span className="v"><span className={`status ${statusCfg.cls}`}>{statusCfg.label}</span></span>
        </div>
        <div className="kv">
          <span className="k">Verzekering</span>
          <span className="v" style={{ color: isGeregistreerd ? "var(--green)" : "inherit" }}>
            {dossier.verzekering_in_orde
              ? "In orde"
              : isGeregistreerd
              ? "In orde"
              : "Nog niet in orde — wacht op registratie"}
          </span>
        </div>
      </div>
    );
  }

  /* ─── Overeenkomst card ─── */
  function OvereenkomstKaart() {
    const rows = (() => {
      const r = (ic, label, date) => ({ ic, label, date });
      const mentorLabel = mentor || dossier.bedrijf_naam;
      const studentGetekend   = fmtDateShort(ovk?.student_getekend_op);
      const bedrijfGetekend   = fmtDateShort(ovk?.bedrijf_getekend_op);
      const opleidingGetekend = fmtDateShort(ovk?.opleiding_getekend_op);
      const gecontroleerd     = fmtDateShort(ovk?.gecontroleerd_op);
      const geregistreerdDat  = fmtDateShort(ovk?.geregistreerd_op);
      const afkeurlabel       = ovk?.afkeurreden ? `afgekeurd — ${ovk.afkeurreden}` : "afgekeurd";

      if (status === "wacht_op_student") return [
        r("ok",    `Opgemaakt door opleiding (EhB)`,             opleidingGetekend || "aangemaakt"),
        r("wacht", `Handtekening student — ${student}`,          "wacht"),
        r("wacht", `Handtekening stagebedrijf — ${mentorLabel}`, "wacht op student"),
        r("wacht", "Controle door administratie",                "nog niet mogelijk"),
        r("wacht", "Registratie",                                "nog niet mogelijk"),
      ];
      if (status === "wacht_op_bedrijf") return [
        r("ok",    `Opgemaakt door opleiding (EhB)`,             opleidingGetekend || "aangemaakt"),
        r("ok",    `Handtekening student — ${student}`,          studentGetekend || "getekend"),
        r("wacht", `Handtekening stagebedrijf — ${mentorLabel}`, "wacht"),
        r("wacht", "Controle door administratie",                "nog niet mogelijk"),
        r("wacht", "Registratie",                                "nog niet mogelijk"),
      ];
      if (status === "in_controle_bij_administratie") return [
        r("ok",    `Opgemaakt door opleiding (EhB)`,             opleidingGetekend || "aangemaakt"),
        r("ok",    `Handtekening student — ${student}`,          studentGetekend || "getekend"),
        r("ok",    `Handtekening stagebedrijf — ${mentorLabel}`, bedrijfGetekend || "getekend"),
        r("wacht", "Controle door administratie",                "te controleren"),
        r("wacht", "Registratie",                                "nog niet geregistreerd"),
      ];
      if (status === "document_afgekeurd") return [
        r("ok",    `Opgemaakt door opleiding (EhB)`,             opleidingGetekend || "aangemaakt"),
        r("ok",    `Handtekening student — ${student}`,          studentGetekend || "getekend"),
        r("ok",    `Handtekening stagebedrijf — ${mentorLabel}`, bedrijfGetekend || "getekend"),
        r("nok",   "Controle door administratie",                gecontroleerd ? `${gecontroleerd} — ${afkeurlabel}` : afkeurlabel),
        r("wacht", "Registratie",                                "wacht op nieuwe versie"),
      ];
      // geregistreerd / stage_loopt / resultaat_vrijgegeven / afgerond
      return [
        r("ok", `Opgemaakt door opleiding (EhB)`,             opleidingGetekend || "aangemaakt"),
        r("ok", `Handtekening student — ${student}`,          studentGetekend || "getekend"),
        r("ok", `Handtekening stagebedrijf — ${mentorLabel}`, bedrijfGetekend || "getekend"),
        r("ok", "Controle door administratie",                gecontroleerd || "gecontroleerd"),
        r("ok", "Registratie — geregistreerd",                geregistreerdDat || "geregistreerd"),
      ];
    })();

    return (
      <div className="card dd_card">
        <div className="dd_card_title">
          <IconFileCertificate size={16} stroke={1.8} />
          Stageovereenkomst
        </div>
        {rows.map((row, i) => {
          const Icon  = row.ic === "ok" ? IconCircleCheck : row.ic === "nok" ? IconCircleX : IconClock;
          const color = row.ic === "ok" ? "var(--green)"  : row.ic === "nok" ? "var(--red)"  : "var(--faint)";
          return <OvkRow key={i} icon={Icon} color={color} label={row.label} date={row.date} />;
        })}

        <div className="dd_doc_row">
          <div className="dd_doc_icon"><IconFileTypePdf size={16} stroke={1.5} /></div>
          <div className="dd_doc_info">
            <div className="dd_doc_naam">stageovereenkomst_{student.toLowerCase().replace(/\s+/g, "_")}.pdf</div>
            <div className="dd_doc_meta">{dossier.bedrijf_naam}</div>
          </div>
          <button className="btn sm" onClick={() => openPreview(ovk?.bestand_url || `/admin/dossiers/${id}/contract-pdf`, `stageovereenkomst_${student.toLowerCase().replace(/\s+/g, "_")}.pdf`)} disabled={!ovk}>
            <IconEye size={13} stroke={2} />
            Bekijken
          </button>
        </div>

        {isGeregistreerd ? (
          <div className="dd_ovk_footer dd_ovk_footer_ok">
            <IconCheck size={13} stroke={2.5} /> De verzekering is in orde.
          </div>
        ) : null}
      </div>
    );
  }

  /* ─── Document controle card ─── */
  function DocumentControleKaart() {
    const docs = dossier.documenten || [];
    if (docs.length === 0) {
      return (
        <div className="card dd_card">
          <div className="dd_card_title"><IconChecklist size={16} stroke={1.8} />Documentcontrole</div>
          <p className="dd_card_muted">Geen documenten gevonden.</p>
        </div>
      );
    }

    const docStatusMap = {
      goedgekeurd:  { cls: "s_ok",    label: "Goedgekeurd" },
      geregistreerd:{ cls: "s_ok",    label: "Geregistreerd" },
      ingediend:    { cls: "s_info",  label: "Ingediend" },
      in_controle:  { cls: "s_amber", label: "In controle" },
      afgekeurd:    { cls: "s_red",   label: "Afgekeurd" },
      ontbreekt:    { cls: "s_gray",  label: "Ontbreekt" },
    };

    return (
      <div className="card dd_card">
        <div className="dd_card_title">
          <IconChecklist size={16} stroke={1.8} />
          Documentcontrole
        </div>
        <div className="dd_doc_list">
          {docs.map((doc) => {
            const cfg = docStatusMap[doc.status] || { cls: "s_gray", label: doc.status };
            const canAct = doc.bestand_naam && ["ingediend", "in_controle"].includes(doc.status);
            return (
              <div key={doc.id} className="dd_doc_ctrl_row">
                <IconFileText size={15} stroke={1.8} className="dd_doc_ctrl_icon" />
                <div className="dd_doc_ctrl_info">
                  <div className="dd_doc_ctrl_naam">
                    {doc.naam}
                    <span className="dd_doc_ctrl_verplicht">
                      {doc.is_verplicht ? " · verplicht" : " · optioneel"}
                    </span>
                  </div>
                  {doc.bestand_naam && (
                    <div className="dd_doc_ctrl_meta">{doc.bestand_naam}</div>
                  )}
                  {doc.afkeurreden && (
                    <div className="dd_doc_ctrl_reden">{doc.afkeurreden}</div>
                  )}
                </div>
                <span className={`status ${cfg.cls}`}>{cfg.label}</span>
                {doc.bestand_naam && (
                  <button className="btn sm" onClick={() => openPreview(doc.bestand_url, doc.bestand_naam)}>
                    <IconEye size={13} stroke={2} />
                    Bekijken
                  </button>
                )}
                {canAct && (
                  <>
                    <button
                      className="btn sm"
                      style={{ color: "var(--red)", borderColor: "var(--red-mid)" }}
                      disabled={actionLoading}
                      onClick={() => { setDocModal({ id: doc.id, naam: doc.naam }); setDocReden(""); setDocRedenError(""); }}
                    >
                      <IconX size={13} stroke={2.5} />
                      Afkeuren
                    </button>
                    <button
                      className="btn sm primary"
                      disabled={actionLoading}
                      onClick={() => doApproveDoc(doc.id)}
                    >
                      <IconCheck size={13} stroke={2.5} />
                      Goedkeuren
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ─── Herinnering card ─── */
  function HerinneringKaart() {
    const isStudent = status === "wacht_op_student";
    const naam  = isStudent ? student : (mentor || dossier.bedrijf_naam);
    const email = isStudent ? dossier.student_email : dossier.mentor_email;
    const sindsLabel = ovk?.student_getekend_op && !isStudent
      ? `Student tekende op ${fmtDateShort(ovk.student_getekend_op)}`
      : "Wacht op handtekening";
    return (
      <div className="card dd_card">
        <div className="dd_card_title">
          <IconMailForward size={16} stroke={1.8} />
          {isStudent ? "Handtekening student" : "Handtekening stagebedrijf"}
        </div>
        <div className="kv"><span className="k">Wacht op</span><span className="v">{naam}</span></div>
        {email && <div className="kv"><span className="k">E-mail</span><span className="v">{email}</span></div>}
        <div className="kv"><span className="k">Status</span><span className="v">{sindsLabel}</span></div>
        {ovk?.versie_nummer && (
          <div className="kv"><span className="k">Versie</span><span className="v">v{ovk.versie_nummer}</span></div>
        )}
        <div className="dd_card_actions">
          <button className="btn" onClick={() => setModal("herinnering")}>
            <IconMailForward size={14} stroke={2} />
            Herinnering sturen
          </button>
        </div>
      </div>
    );
  }

  /* ─── Beslissing card ─── */
  function BeslisKaart() {
    return (
      <div className="card dd_card dd_card_featured">
        <div className="dd_card_title">
          <IconRubberStamp size={16} stroke={1.8} />
          Controle &amp; registratie
        </div>
        <p className="dd_beslis_desc">
          Alle handtekeningen zijn binnen. Controleer de documenten en registreer de stageovereenkomst — pas daarna is de verzekering in orde.
        </p>
        <div className="dd_beslis_actions">
          <button
            className="btn"
            style={{ color: "var(--red)", borderColor: "var(--red-mid)" }}
            onClick={() => setModal("afkeuren")}
          >
            <IconX size={14} stroke={2.5} />
            Afkeuren
          </button>
          <button className="btn primary" onClick={() => setModal("registreren")}>
            <IconCheck size={14} stroke={2.5} />
            Goedkeuren &amp; registreren
          </button>
        </div>
      </div>
    );
  }

  /* ─── Eindoverzicht card ─── */
  function EindoverzichtKaart() {
    const afgerond = status === "afgerond";
    return (
      <div className="card dd_card">
        <div className="dd_card_title">
          <IconFileExport size={16} stroke={1.8} />
          Eindoverzicht
        </div>
        <div className="kv"><span className="k">Student</span><span className="v">{student}</span></div>
        <div className="kv"><span className="k">Dossier</span><span className="v">{dossier.dossiernummer}</span></div>
        {dossier.eindresultaat && (
          <div className="kv"><span className="k">Eindresultaat</span><span className="v">{dossier.eindresultaat}</span></div>
        )}
        <div className="kv"><span className="k">Vrijgegeven door</span><span className="v">{docent || "—"}</span></div>
        <div className="kv">
          <span className="k">Inhoud</span>
          <span className="v">Competentiescores · eindpresentatie · eindcijfer · logboekstatus · stageperiode · documentstatus</span>
        </div>
        {afgerond && (() => {
          const eindDoc = (dossier.documenten || []).find((d) => d.type === "eindoverzicht");
          return (
            <div className="dd_doc_row" style={{ marginTop: 8 }}>
              <div className="dd_doc_icon"><IconFileTypePdf size={16} stroke={1.5} /></div>
              <div className="dd_doc_info">
                <div className="dd_doc_naam">eindoverzicht_{student.toLowerCase().replace(/\s+/g, "_")}.pdf</div>
                <div className="dd_doc_meta">Zichtbaar voor student en stagebegeleider</div>
              </div>
              <button className="btn sm" onClick={() => openPreview(eindDoc?.bestand_url, `eindoverzicht_${student.toLowerCase().replace(/\s+/g, "_")}.pdf`)} disabled={!eindDoc?.bestand_url}>
                <IconEye size={13} stroke={2} />Bekijken
              </button>
            </div>
          );
        })()}
        {!afgerond && (
          <div className="dd_card_actions">
            <button className="btn primary" onClick={() => setModal("eindoverzicht")}>
              <IconFileExport size={14} stroke={2} />
              Eindoverzicht genereren
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ─── Read-only opvolgingskaart ─── */
  function OpvolgingKaart() {
    return (
      <div className="card dd_card">
        <div className="dd_card_title">
          <IconWalk size={16} stroke={1.8} />
          Opvolging
        </div>
        {dossier.startdatum && <div className="kv"><span className="k">Gestart</span><span className="v">{fmtDate(dossier.startdatum)}</span></div>}
        {dossier.einddatum && <div className="kv"><span className="k">Einddatum</span><span className="v">{fmtDate(dossier.einddatum)}</span></div>}
        {dossier.aantal_weken && <div className="kv"><span className="k">Duur</span><span className="v">{dossier.aantal_weken} weken · {dossier.uren_per_week || "—"}u/week</span></div>}
        <div className="kv"><span className="k">Dossierdocumenten</span><span className="v">Compleet</span></div>
        <div className="kv"><span className="k">Verzekering</span><span className="v" style={{ color: "var(--green)" }}>In orde</span></div>
        <div className="kv"><span className="k">Administratieve actie</span><span className="v dd_muted">Geen — logboek en evaluatie lopen bij student, mentor en docent</span></div>
        <div className="dd_card_actions">
          <button className="btn sm" onClick={() => navigate("/admin/users")}>
            <IconUsers size={14} stroke={2} />
            Gebruikers bekijken
          </button>
        </div>
      </div>
    );
  }

  /* ─── Student bar subline ─── */
  const subline = `${dossier.dossiernummer || "—"} · ${dossier.bedrijf_naam || "—"}`;

  /* ─── Banner per state ─── */
  function renderBanner() {
    if (status === "wacht_op_student") return (
      <Banner type="gray" icon={IconClock} title="Wacht op handtekening student"
        text={`${student} moet de stageovereenkomst ondertekenen.`} />
    );
    if (status === "wacht_op_bedrijf") return (
      <Banner type="gray" icon={IconClock} title="Wacht op handtekening stagebedrijf"
        text={`${mentor || dossier.bedrijf_naam} moet de stageovereenkomst ondertekenen namens ${dossier.bedrijf_naam}.`} />
    );
    if (status === "in_controle_bij_administratie") return (
      <Banner type="amber" icon={IconAlertTriangle} title="Actie vereist — stageovereenkomst controleren"
        text="Alle handtekeningen zijn binnen. Controleer de documenten en registreer de stageovereenkomst." />
    );
    if (status === "document_afgekeurd") return (
      <Banner type="red" icon={IconX} title="Afgekeurd — wacht op nieuwe versie"
        text="De student werd verwittigd en kan een nieuwe versie opladen." />
    );
    if (status === "geregistreerd") return (
      <Banner type="green" icon={IconCheck} title="Geregistreerd — dossier compleet en startklaar"
        text={`De verzekering is in orde. Stage start ${fmtDate(dossier.startdatum) || "binnenkort"}.`} />
    );

    if (status === "resultaat_vrijgegeven") return (
      <Banner type="amber" icon={IconFileExport} title="Eindresultaat vrijgegeven — eindoverzicht te genereren"
        text={`${docent || "De stagebegeleider"} gaf het eindresultaat vrij. De administratie genereert nu het eindoverzicht.`} />
    );
    if (status === "afgerond") return (
      <Banner type="green" icon={IconCheck} title="Dossier afgerond — eindoverzicht gegenereerd"
        text="Het eindoverzicht is zichtbaar voor de student en de stagebegeleider." />
    );
    return null;
  }

  return (
    <div className="page">
      {/* Back link */}
      <button className="dd_back" onClick={() => navigate("/admin/dossiers")}>
        <IconArrowLeft size={14} stroke={2.2} />
        Terug naar dossiers
      </button>

      {/* Student bar */}
      <div className="dd_student_bar">
        <div className="dd_student_avatar">{ini}</div>
        <div className="dd_student_info">
          <div className="dd_student_naam">{student}</div>
          <div className="dd_student_sub">{subline}</div>
        </div>
        <span className={`status ${statusCfg.cls} dd_status_badge`}>{statusCfg.label}</span>
      </div>

      {/* Steps */}
      <Steps status={status} />

      {/* Banner */}
      {renderBanner()}

      {/* ── STAGE LOOPT layout ── */}
      {isLoopt && (
        <div className="dd_grid_2">
          <div className="dd_col">
            <DossierKaart />
            <OpvolgingKaart />
          </div>
          <div className="dd_col">
            <DocumentControleKaart />
          </div>
        </div>
      )}

      {/* ── CONTRACT / CONTROLE layout ── */}
      {isContract && (
        <div className="dd_grid_2">
          <div className="dd_col">
            <DossierKaart />
            {isControleer && <BeslisKaart />}
            {(status === "wacht_op_student" || status === "wacht_op_bedrijf") && <HerinneringKaart />}
          </div>
          <div className="dd_col">
            <OvereenkomstKaart />
            <DocumentControleKaart />
          </div>
        </div>
      )}

      {/* ── AFSLUITING layout ── */}
      {isAfsluiting && (
        <div className="dd_grid_2">
          <div className="dd_col">
            <EindoverzichtKaart />
          </div>
          <div className="dd_col">
            <DossierKaart />
          </div>
        </div>
      )}

      {/* ══════════════════════ MODALS ══════════════════════ */}

      {/* Registreren */}
      {modal === "registreren" && (
        <div className="modal_overlay" onClick={() => setModal(null)}>
          <div className="modal_box" onClick={(e) => e.stopPropagation()}>
            <div className="modal_header">
              <span className="modal_title">Stageovereenkomst registreren</span>
              <button className="icon_close" onClick={() => setModal(null)}><IconX size={16} stroke={2} /></button>
            </div>
            <div className="modal_body">
              <p className="modal_desc">Na registratie is de stageovereenkomst definitief en is de verzekering in orde.</p>
              <div className="kv"><span className="k">Student</span><span className="v">{student}</span></div>
              <div className="kv"><span className="k">Dossier</span><span className="v">{dossier.dossiernummer}</span></div>
              <div className="kv"><span className="k">Stagebedrijf</span><span className="v">{dossier.bedrijf_naam}</span></div>
              {dossier.startdatum && dossier.einddatum && (
                <div className="kv"><span className="k">Periode</span><span className="v">{fmtDate(dossier.startdatum)} – {fmtDate(dossier.einddatum)}</span></div>
              )}
            </div>
            <div className="modal_footer">
              <button className="btn" onClick={() => setModal(null)}>Annuleren</button>
              <button className="btn primary" onClick={doRegistreer} disabled={actionLoading}>
                <IconCheck size={14} stroke={2.5} />
                {actionLoading ? "Bezig…" : "Registreren"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Afkeuren */}
      {modal === "afkeuren" && (
        <div className="modal_overlay" onClick={() => setModal(null)}>
          <div className="modal_box" onClick={(e) => e.stopPropagation()}>
            <div className="modal_header">
              <span className="modal_title">Document afkeuren</span>
              <button className="icon_close" onClick={() => setModal(null)}><IconX size={16} stroke={2} /></button>
            </div>
            <div className="modal_body">
              <div className="modal_field">
                <label className="modal_label">Reden <span className="modal_required">*</span></label>
                <textarea
                  className="modal_textarea"
                  rows={4}
                  placeholder="De student ziet deze reden en kan een nieuwe versie opladen…"
                  value={afkeurReden}
                  onChange={(e) => { setAfkeurReden(e.target.value); setAfkeurError(""); }}
                />
                {afkeurError && <span className="modal_error">{afkeurError}</span>}
              </div>
            </div>
            <div className="modal_footer">
              <button className="btn" onClick={() => setModal(null)}>Annuleren</button>
              <button
                className="btn"
                style={{ background: "var(--red)", color: "#fff", borderColor: "var(--red)" }}
                onClick={doAfkeuren}
                disabled={actionLoading}
              >
                <IconX size={14} stroke={2.5} />
                {actionLoading ? "Bezig…" : "Afkeuren"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Herinnering */}
      {modal === "herinnering" && (
        <div className="modal_overlay" onClick={() => setModal(null)}>
          <div className="modal_box" onClick={(e) => e.stopPropagation()}>
            <div className="modal_header">
              <span className="modal_title">Herinnering sturen</span>
              <button className="icon_close" onClick={() => setModal(null)}><IconX size={16} stroke={2} /></button>
            </div>
            <div className="modal_body">
              <p className="modal_desc">
                {status === "wacht_op_student"
                  ? `${student} ontvangt een melding om de stageovereenkomst te ondertekenen.`
                  : `${mentor || dossier.bedrijf_naam} ontvangt een melding om de stageovereenkomst namens ${dossier.bedrijf_naam} te ondertekenen.`}
              </p>
            </div>
            <div className="modal_footer">
              <button className="btn" onClick={() => setModal(null)}>Annuleren</button>
              <button className="btn primary" onClick={doHerinnering} disabled={actionLoading}>
                <IconMailForward size={14} stroke={2} />
                {actionLoading ? "Bezig..." : "Versturen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Eindoverzicht */}
      {modal === "eindoverzicht" && (
        <div className="modal_overlay" onClick={() => setModal(null)}>
          <div className="modal_box" onClick={(e) => e.stopPropagation()}>
            <div className="modal_header">
              <span className="modal_title">Eindoverzicht genereren</span>
              <button className="icon_close" onClick={() => setModal(null)}><IconX size={16} stroke={2} /></button>
            </div>
            <div className="modal_body">
              <p className="modal_desc">
                Het eindoverzicht wordt als pdf toegevoegd aan het stagedossier en zichtbaar voor student en stagebegeleider.
              </p>
              <div className="kv"><span className="k">Student</span><span className="v">{student}</span></div>
              <div className="kv"><span className="k">Dossier</span><span className="v">{dossier.dossiernummer}</span></div>
              {dossier.eindresultaat && (
                <div className="kv"><span className="k">Eindresultaat</span><span className="v">{dossier.eindresultaat}</span></div>
              )}
              <div className="kv"><span className="k">Vrijgegeven door</span><span className="v">{docent || "—"}</span></div>
            </div>
            <div className="modal_footer">
              <button className="btn" onClick={() => setModal(null)}>Annuleren</button>
              <button className="btn primary" onClick={doEindoverzicht} disabled={actionLoading}>
                <IconFileExport size={14} stroke={2} />
                {actionLoading ? "Bezig..." : "Genereren"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document afkeuren */}
      {docModal && (
        <div className="modal_overlay" onClick={() => setDocModal(null)}>
          <div className="modal_box" onClick={(e) => e.stopPropagation()}>
            <div className="modal_header">
              <span className="modal_title">Document afkeuren</span>
              <button className="icon_close" onClick={() => setDocModal(null)}><IconX size={16} stroke={2} /></button>
            </div>
            <div className="modal_body">
              <div className="kv"><span className="k">Document</span><span className="v">{docModal.naam}</span></div>
              <div className="modal_field" style={{ marginTop: 10 }}>
                <label className="modal_label">Reden <span className="modal_required">*</span></label>
                <textarea
                  className="modal_textarea"
                  rows={3}
                  placeholder="De student ziet deze reden en kan een nieuwe versie opladen..."
                  value={docReden}
                  onChange={(e) => { setDocReden(e.target.value); setDocRedenError(""); }}
                />
                {docRedenError && <span className="modal_error">{docRedenError}</span>}
              </div>
            </div>
            <div className="modal_footer">
              <button className="btn" onClick={() => setDocModal(null)}>Annuleren</button>
              <button
                className="btn"
                style={{ background: "var(--red)", color: "#fff", borderColor: "var(--red)" }}
                onClick={doRejectDoc}
                disabled={actionLoading}
              >
                <IconX size={14} stroke={2.5} />
                {actionLoading ? "Bezig..." : "Afkeuren"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview */}
      {preview && (
        <div className="modal_overlay" onClick={() => { setPreview(null); setIframeErr(false); }}>
          <div className="modal_box" style={{ maxWidth: 860, width: "92vw" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal_header">
              <span className="modal_title">{preview.naam}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <a href={fileUrl(preview.url)} target="_blank" rel="noreferrer" className="btn sm">
                  <IconFileExport size={13} stroke={2} /> Openen in nieuw venster
                </a>
                <button className="icon_close" onClick={() => { setPreview(null); setIframeErr(false); }}><IconX size={16} stroke={2} /></button>
              </div>
            </div>
            <div className="modal_body" style={{ padding: 0 }}>
              {/\.(png|jpe?g|gif|webp)(\?|$)/i.test(preview.url) ? (
                <img src={fileUrl(preview.url)} alt={preview.naam} style={{ maxWidth: "100%", display: "block", borderRadius: "0 0 14px 14px" }} />
              ) : iframeErr ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, height: "70vh", color: "var(--faint)" }}>
                  <IconFileOff size={40} stroke={1.4} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Document niet beschikbaar</span>
                </div>
              ) : (
                <iframe
                  src={fileUrl(preview.url)}
                  title={preview.naam}
                  style={{ width: "100%", height: "70vh", border: "none", borderRadius: "0 0 14px 14px", display: "block" }}
                  onLoad={(e) => {
                    try {
                      const text = e.target.contentDocument?.body?.innerText || "";
                      if (text.includes('"success":false')) setIframeErr(true);
                    } catch {}
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`dd_toast ${toast.type === "error" ? "dd_toast_error" : ""}`}>
          {toast.type === "error" ? <IconX size={14} stroke={2.5} /> : <IconCheck size={14} stroke={2.5} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
