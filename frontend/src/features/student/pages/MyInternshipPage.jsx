import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiRequest } from "../../../services/api";
import "./MyInternshipPage.css";
import Modal from "../../../components/ui/Modal";
import {
  IconSend, IconX, IconCheck, IconBriefcase, IconPlus,
  IconInfoCircle, IconUsers, IconFileDescription, IconChevronRight,
  IconBuilding, IconCalendar, IconUserCheck,
  IconClipboardText, IconArrowBackUp, IconNotebook, IconArrowRight,
  IconHourglass, IconPencil, IconAlertCircle, IconDeviceFloppy, IconTrophy,
  IconHistory, IconSignature, IconUpload, IconListCheck, IconCircleCheck,
} from "@tabler/icons-react";

const FASES = ["Voorstel", "Beoordeling", "Contract", "Stage", "Evaluatie"];

const FASE_IDX = {
  concept: 0, ingetrokken: 0,
  ingediend: 1, aanpassingen_gevraagd: 1, heringediend: 1, afgekeurd: 1,
  goedgekeurd: 2,
  resultaat_vrijgegeven: 4, afgerond: 4,
};

function isStageGestart(startdatum) {
  if (!startdatum) return false;
  const start = new Date(startdatum);
  start.setHours(0, 0, 0, 0);
  const vandaag = new Date();
  vandaag.setHours(0, 0, 0, 0);
  return vandaag >= start;
}

function getFaseIdx(status, contractGetekend, gestart) {
  if (status === "goedgekeurd" && contractGetekend && gestart) return 4;
  if (status === "goedgekeurd" && contractGetekend) return 3;
  return FASE_IDX[status] ?? 0;
}

function getSubs(status, contractGetekend, gestart) {
  if (status === "goedgekeurd" && contractGetekend && gestart)
    return ["Ingediend", "Goedgekeurd", "Geregistreerd", "Stage loopt", "—"];
  if (status === "goedgekeurd" && contractGetekend)
    return ["Ingediend", "Goedgekeurd", "Getekend", "Wacht op startdatum", "—"];
  const map = {
    concept:               ["Concept opgeslagen", "—", "—", "—", "—"],
    ingediend:             ["Ingediend", "Wacht op beslissing", "—", "—", "—"],
    aanpassingen_gevraagd: ["Ingediend", "Aanpassing nodig", "—", "—", "—"],
    heringediend:          ["Heringediend", "Wacht op beslissing", "—", "—", "—"],
    afgekeurd:             ["Ingediend", "Afgekeurd", "—", "—", "—"],
    goedgekeurd:           ["Ingediend", "Goedgekeurd", "Te ondertekenen", "—", "—"],
    resultaat_vrijgegeven: ["Ingediend", "Goedgekeurd", "Geregistreerd", "Afgerond", "Vrijgegeven"],
    afgerond:              ["Ingediend", "Goedgekeurd", "Geregistreerd", "Afgerond", "Afgesloten"],
  };
  return map[status] ?? ["Nog niet gestart", "—", "—", "—", "—"];
}

function ProgressBar({ status, contractGetekend, startdatum }) {
  const gestart = isStageGestart(startdatum);
  const idx  = getFaseIdx(status, contractGetekend, gestart);
  const subs = getSubs(status, contractGetekend, gestart);
  return (
    <div className="steps">
      {FASES.map((fase, i) => {
        const cls = i < idx ? "done" : i === idx ? "active" : "";
        let vul = 0;
        if (i + 1 < idx) vul = 100;
        else if (i + 1 === idx) vul = 50;
        return (
          <div key={fase} className={`step${cls ? ` ${cls}` : ""}`}>
            <div className="step-block">
              <div className="step-circle">
                {i < idx ? <IconCheck size={17} /> : i + 1}
              </div>
              <div className="step-col">
                <span className="step-label">{fase}</span>
                <span className="step-sub">{subs[i] || "—"}</span>
              </div>
            </div>
            {i < FASES.length - 1 && (
              <div className="step-line">
                <span className="fill" style={{ width: `${vul}%` }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DossierKaart({ titel, data, formatDatum }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="dossier">
      <button className={`dossier-kop${open ? " open" : ""}`} onClick={() => setOpen(o => !o)}>
        <i className="ti ti-chevron-right"></i>
        {titel}
      </button>
      <div className={`dossier-body${open ? " open" : ""}`}>
        <div className="grid_2">
          <div className="card">
            <div className="card_title"><IconBuilding size={16} />Bedrijf</div>
            <div className="kv"><span className="k">Bedrijf</span><span className="v">{data?.bedrijf_naam || "—"}</span></div>
            <div className="kv"><span className="k">Functie</span><span className="v">{data?.stagefunctie || "—"}</span></div>
            <div className="kv"><span className="k">Afdeling</span><span className="v">{data?.bedrijfsafdeling || "—"}</span></div>
          </div>
          <div className="card">
            <div className="card_title"><IconCalendar size={16} />Periode</div>
            <div className="kv"><span className="k">Start</span><span className="v">{formatDatum(data?.startdatum)}</span></div>
            <div className="kv"><span className="k">Einde</span><span className="v">{formatDatum(data?.einddatum)}</span></div>
            <div className="kv"><span className="k">Uren/week</span><span className="v">{data?.uren_per_week ? `${data.uren_per_week}u` : "—"}</span></div>
          </div>
        </div>
        <div className="card">
          <div className="card_title"><IconFileDescription size={16} />Opdracht</div>
          <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--sub)", margin: 0 }}>{data?.opdrachtomschrijving || "—"}</p>
        </div>
      </div>
    </div>
  );
}

function BegeleidingKaart({ data, wacht }) {
  return (
    <div className="card">
      <div className="card_title"><IconUsers size={16} />Begeleiding</div>
      {data?.mentor_naam && (
        <div className="prof">
          <div className="prof-av">{data.mentor_naam.split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase()}</div>
          <div>
            <div className="p-naam">{data.mentor_naam}</div>
            <div className="p-rol">{data.bedrijf_naam}{wacht ? " (voorgesteld)" : ""}</div>
            {data.mentor_email && <div className="p-mail">{data.mentor_email}</div>}
          </div>
        </div>
      )}
      <div className="prof">
        <div className="prof-av grijs"><i className="ti ti-user-question" style={{ fontSize: 16 }}></i></div>
        <div>
          <div className="p-naam">Stagebegeleider wordt toegewezen</div>
          <div className="p-rol">{wacht ? "Definitief na goedkeuring" : "Erasmushogeschool Brussel"}</div>
        </div>
      </div>
    </div>
  );
}

const VERBERG_DOC = new Set(["reflectiebijlage", "eindoverzicht", "stageovereenkomst"]);
const DOC_ACTIE_STATUS = new Set(["ontbreekt", "afgekeurd"]);

function TaakKaart({ status, contractStudentGekend, volledigGetekend, docsOk, navigate, startdatum }) {
  if (status !== "goedgekeurd") {
    return null;
  }

  const contractOk = !!contractStudentGekend;
  const alleOk = contractOk && docsOk;
  const gestart = isStageGestart(startdatum);

  return (
    <div className="taak-kaart">
      <div className="card_title">
        <i className="ti ti-list-check"></i>
        Wat moet je nu doen
      </div>

      {alleOk && gestart ? (
        <div className="taak-rij">
          <div className="taak-icon groen"><i className="ti ti-circle-check"></i></div>
          <div className="taak-info">Je stage loopt. Vul wekelijks je logboek in.</div>
          <button className="btn primary sm" onClick={() => navigate("/student/logbook")}>
            Logboek <IconArrowRight size={13} />
          </button>
        </div>
      ) : alleOk && volledigGetekend ? (
        <div className="taak-rij">
          <div className="taak-icon groen"><i className="ti ti-circle-check"></i></div>
          <div className="taak-info">Alles in orde — je stage start binnenkort.</div>
        </div>
      ) : alleOk && !volledigGetekend ? (
        <div className="taak-rij">
          <div className="taak-icon amber"><i className="ti ti-hourglass"></i></div>
          <div className="taak-info">Wacht op de handtekening van het stagebedrijf.</div>
        </div>
      ) : (
        <>
          {/* Contract taak */}
          <div className="taak-rij">
            <div className={`taak-icon ${contractOk ? "groen" : "amber"}`}>
              <i className={`ti ${contractOk ? "ti-circle-check" : "ti-signature"}`}></i>
            </div>
            <div className="taak-info">
              {contractOk ? "Stageovereenkomst ondertekend." : "Onderteken je stageovereenkomst digitaal."}
            </div>
            {!contractOk && (
              <button className="btn primary sm" onClick={() => navigate("/student/contract")}>
                Ga <IconArrowRight size={13} />
              </button>
            )}
          </div>

          {/* Documenten taak */}
          <div className="taak-rij">
            <div className={`taak-icon ${docsOk ? "groen" : "amber"}`}>
              <i className={`ti ${docsOk ? "ti-circle-check" : "ti-upload"}`}></i>
            </div>
            <div className="taak-info">
              {docsOk ? "Verplichte documenten geüpload." : "Upload je verplichte stagedocumenten."}
            </div>
            {!docsOk && (
              <button className="btn primary sm" onClick={() => navigate("/student/documents")}>
                Ga <IconArrowRight size={13} />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Echte versie-/beslissingstijdlijn van het eigen voorstel (Story 3/4).
function Historiek({ items }) {
  const fmt = (t) => {
    if (!t) return "—";
    const d = new Date(t);
    return d.toLocaleDateString("nl-BE", { day: "2-digit", month: "short", year: "numeric" }) +
      " " + d.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
  };
  const lijst = Array.isArray(items) && items.length > 0 ? items : null;
  return (
    <div className="card">
      <div className="card_title"><IconHistory size={16} />Historiek</div>
      {lijst
        ? lijst.map((ev, i) => (
            <div key={i} className={`versie${ev.actief ? " actief" : ""}`}>
              <div className="v-left">
                <span className="v-dot"></span>
                <span className="v-wat"><b>{ev.wat}</b></span>
              </div>
              <span className="v-tijd">{fmt(ev.tijd)}</span>
            </div>
          ))
        : <p style={{ fontSize: 13, color: "var(--sub)" }}>Nog geen historiek beschikbaar.</p>}
    </div>
  );
}

export default function MyInternshipPage() {
  const navigate  = useNavigate();
  const location  = useLocation();

  const [showPopup,        setShowPopup]        = useState(location.state?.ingediend || false);
  const [internship,       setInternship]       = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [intrekModal,      setIntrekModal]      = useState(false);
  const [intrekken,        setIntrekken]        = useState(false);
  const [intrekFout,       setIntrekFout]       = useState(null);
  const [contractStudentGekend, setContractStudentGekend] = useState(false);
  const [volledigGetekend, setVolledigGetekend] = useState(false);
  const [docsOk, setDocsOk] = useState(false);
  const [historiek, setHistoriek] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await apiRequest("GET", "/internships/my");
        if (res.data) setInternship(res.data);
      } catch {
        // geen voorstel
      } finally {
        setLoading(false);
      }
      try {
        const res = await apiRequest("GET", "/internships/my/historiek");
        if (Array.isArray(res.data)) setHistoriek(res.data);
      } catch {
        // geen historiek — ok
      }
      try {
        const res = await apiRequest("GET", "/contracts/my");
        const c = res.data;
        setContractStudentGekend(!!c?.student_getekend_op);
        // Volledig getekend = student + bedrijf (mentor) beide getekend; opleiding_getekend_op wordt niet gebruikt
        setVolledigGetekend(!!(c?.student_getekend_op && c?.bedrijf_getekend_op));
      } catch {
        // geen contract — ok
      }
      try {
        const [docsRes, soortenRes] = await Promise.all([
          apiRequest("GET", "/documents/my"),
          apiRequest("GET", "/documents/soorten"),
        ]);
        const docs = docsRes.data ?? [];
        const soorten = (soortenRes.data ?? []).filter((s) => {
          const t = (s.type ?? "").toLowerCase();
          const n = (s.naam ?? "").toLowerCase();
          return !VERBERG_DOC.has(t) && !VERBERG_DOC.has(n);
        });
        const alleGoed = soorten.length > 0 && soorten.every((s) => {
          const actief = docs
            .filter((d) => d.document_soort_id === s.id)
            .sort((a, b) => (b.versie_nummer ?? 0) - (a.versie_nummer ?? 0))[0];
          return actief && !DOC_ACTIE_STATUS.has(actief.status);
        });
        setDocsOk(alleGoed);
      } catch {
        // docs niet beschikbaar
      }
    }
    fetchData();
  }, []);

  function formatDatum(datum) {
    if (!datum) return "—";
    return new Date(datum).toLocaleDateString("nl-BE");
  }

  async function handleIntrekken() {
    setIntrekken(true);
    setIntrekFout(null);
    try {
      await apiRequest("PATCH", "/internships/my/intrekken");
      setIntrekModal(false);
      const res = await apiRequest("GET", "/internships/my");
      setInternship(res.data || null);
    } catch (err) {
      setIntrekFout(err.response?.data?.message || "Intrekken mislukt.");
    } finally {
      setIntrekken(false);
    }
  }

  if (loading) {
    return (
      <div className="page-inner">
        <div className="page-header"><h1>Mijn stage</h1></div>
        <div className="card"><p>Bezig met laden...</p></div>
      </div>
    );
  }

  const currentStatus = internship?.status || (location.state?.ingediend ? "ingediend" : null);
  const heeftVoorstel = !!internship || location.state?.ingediend;
  const isConcept     = currentStatus === "concept";
  const isAfgesloten  = ["afgekeurd", "ingetrokken"].includes(currentStatus);
  const isIngediend   = currentStatus === "ingediend";
  const isAanpassingen = currentStatus === "aanpassingen_gevraagd";
  const isHeringediend = currentStatus === "heringediend";
  const isGoedgekeurd = ["goedgekeurd", "teruggestuurd", "validatie"].includes(currentStatus);
  const kanIntrekken  = ["ingediend", "heringediend", "aanpassingen_gevraagd"].includes(currentStatus);
  const data          = internship;
  const decisionMessage = data?.laatste_feedback || data?.laatste_motivering || data?.feedback || data?.motivering;

  const pageTitle = (isGoedgekeurd && data?.stagefunctie && data?.bedrijf_naam)
    ? `${data.stagefunctie} bij ${data.bedrijf_naam}`
    : "Mijn stage";

  return (
    <>
    <div className="page-inner">

      <div className="page-header">
        <h1>{pageTitle}</h1>
        <p>Academiejaar 2025-2026</p>
      </div>

      {/* ── GEEN VOORSTEL ── */}
      {!heeftVoorstel && (
        <>
          <ProgressBar status={null} contractGetekend={false} />
          <div className="card">
            <div className="empty-hero">
              <div className="eh-icon"><i className="ti ti-briefcase"></i></div>
              <h2>Je hebt nog geen stage</h2>
              <p>Alles start met je stagevoorstel: bedrijf, mentor, opdracht en periode. Na indiening bekijkt de stagecommissie je voorstel.</p>
              <button className="btn primary" onClick={() => navigate("/student/application")}>
                <IconPlus size={16} />Stagevoorstel indienen
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── CONCEPT ── */}
      {isConcept && (
        <>
          <ProgressBar status={currentStatus} contractGetekend={false} />
          <div className="banner blauw">
            <i className="ti ti-device-floppy"></i>
            <div>
              <div className="b-title">Dit is nog maar een concept</div>
              <div className="b-text">Je voorstel is bewaard maar nog níet ingediend — de stagecommissie ziet het dus nog niet. Werk de ontbrekende velden af en klik op "Indienen".</div>
              <div style={{ marginTop: 10 }}>
                <button className="btn primary sm" onClick={() => navigate("/student/application")}>
                  <IconPencil size={13} /> Concept afwerken
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── AFGEKEURD ── */}
      {currentStatus === "afgekeurd" && (
        <>
          <ProgressBar status={currentStatus} contractGetekend={false} />
          <div className="banner rood" style={{ alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div className="b-title">Voorstel afgekeurd</div>
              {decisionMessage && <div className="b-text">"{decisionMessage}"</div>}
            </div>
            <button className="btn primary sm" onClick={() => navigate("/student/application")}>
              <IconPlus size={13} /> Nieuw voorstel starten
            </button>
          </div>
          <Historiek items={historiek} />
        </>
      )}

      {/* ── INGETROKKEN ── */}
      {currentStatus === "ingetrokken" && (
        <>
          <ProgressBar status={currentStatus} contractGetekend={false} />
          <div className="banner rood" style={{ alignItems: "center" }}>
            <i className="ti ti-arrow-back-up"></i>
            <div style={{ flex: 1 }}>
              <div className="b-title">Voorstel ingetrokken</div>
              <div className="b-text">Je stagevoorstel werd ingetrokken. De stagecommissie behandelt dit voorstel niet meer. Je kan een nieuw voorstel starten.</div>
            </div>
            <button className="btn primary sm" onClick={() => navigate("/student/application")}>
              <IconPlus size={13} /> Nieuw voorstel starten
            </button>
          </div>
          <Historiek items={historiek} />
        </>
      )}

      {/* ── INGEDIEND ── */}
      {isIngediend && (
        <>
          <ProgressBar status={currentStatus} contractGetekend={false} />
          <div className="banner blauw">
            <i className="ti ti-clock"></i>
            <div>
              <div className="b-title">Stagevoorstel ingediend — beslissing volgt</div>
              <div className="b-text">Je stagevoorstel wordt behandeld door de stagecommissie. Je krijgt een melding zodra er een beslissing is.</div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 14 }}>
            <div className="grid_2">
              <div>
                <DossierKaart titel="Je voorstel zoals ingediend — nog niet goedgekeurd" data={data} formatDatum={formatDatum} />
                {kanIntrekken && (
                  <button className="btn" style={{ marginTop: 10 }} onClick={() => setIntrekModal(true)}>
                    <IconArrowBackUp size={14} /> Voorstel intrekken
                  </button>
                )}
              </div>
              <BegeleidingKaart data={data} wacht={true} />
            </div>
          </div>
        </>
      )}

      {/* ── HERINGEDIEND ── */}
      {isHeringediend && (
        <>
          <ProgressBar status={currentStatus} contractGetekend={false} />
          <div className="banner blauw">
            <i className="ti ti-send"></i>
            <div>
              <div className="b-title">Aangepast voorstel heringediend</div>
              <div className="b-text">Je hebt versie 2 van je stagevoorstel ingediend. De stagecommissie herbeoordeelt je aanvraag. Je krijgt een melding zodra er een beslissing is.</div>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <Historiek items={historiek} />
          </div>
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 14 }}>
            <div className="grid_2">
              <div>
                <DossierKaart titel="Je voorstel zoals ingediend" data={data} formatDatum={formatDatum} />
                <button className="btn" style={{ marginTop: 10 }} onClick={() => setIntrekModal(true)}>
                  <IconArrowBackUp size={14} /> Voorstel intrekken
                </button>
              </div>
              <BegeleidingKaart data={data} wacht={true} />
            </div>
          </div>
        </>
      )}

      {/* ── AANPASSINGEN GEVRAAGD ── */}
      {isAanpassingen && (
        <>
          <ProgressBar status={currentStatus} contractGetekend={false} />
          <div className="card" style={{ marginBottom: 16, border: "1.5px solid #0a0a0a", boxShadow: "0 4px 14px rgba(0,0,0,.10)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
              <div className="taak-icon amber" style={{ width: 34, height: 34, fontSize: 17, borderRadius: 8, flexShrink: 0 }}>
                <i className="ti ti-message-circle"></i>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>Feedback van de stagecommissie</div>
                {decisionMessage && <div style={{ fontSize: 12.5, color: "var(--sub)", marginTop: 3, lineHeight: 1.5 }}>{decisionMessage}</div>}
              </div>
              <button className="btn primary sm" onClick={() => navigate("/student/application")}>
                <IconPencil size={13} /> Aanpassen
              </button>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <Historiek items={historiek} />
          </div>
        </>
      )}

      {/* ── GOEDGEKEURD / TERUGGESTUURD / VALIDATIE ── */}
      {isGoedgekeurd && (
        <>
          <ProgressBar status={currentStatus} contractGetekend={volledigGetekend} startdatum={internship?.startdatum} />
          <TaakKaart status={currentStatus} contractStudentGekend={contractStudentGekend} volledigGetekend={volledigGetekend} docsOk={docsOk} navigate={navigate} startdatum={internship?.startdatum} />
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 14 }}>
            <div className="grid_2">
              <DossierKaart
                titel={`Je stagedossier — goedgekeurd${data?.stagefunctie ? ` · ${data.stagefunctie}` : ""}`}
                data={data}
                formatDatum={formatDatum}
              />
              <BegeleidingKaart data={data} wacht={false} />
            </div>
          </div>
        </>
      )}

    </div>

    {/* Modal: stagevoorstel ingediend */}
    <Modal
      open={showPopup}
      onClose={() => setShowPopup(false)}
      icon="ti-send"
      titel="Stagevoorstel ingediend"
      footer={
        <button className="btn primary" onClick={() => setShowPopup(false)}>
          <i className="ti ti-check"></i> Begrepen
        </button>
      }
    >
      <p>Je stagevoorstel werd ingediend bij de stagecommissie. Je krijgt een melding na de beoordeling.</p>
    </Modal>

    {/* Modal: voorstel intrekken bevestiging */}
    <Modal
      open={intrekModal}
      onClose={() => { if (!intrekken) setIntrekModal(false); }}
      icon="ti-arrow-back-up"
      titel="Voorstel intrekken"
      sub="Ben je zeker?"
      footer={
        <>
          <button className="btn" onClick={() => setIntrekModal(false)} disabled={intrekken}>Annuleren</button>
          <button className="btn primary" style={{ background: "var(--red)" }} onClick={handleIntrekken} disabled={intrekken}>
            <i className="ti ti-arrow-back-up"></i>
            {intrekken ? "Bezig..." : "Ja, intrekken"}
          </button>
        </>
      }
    >
      <p>Ben je zeker dat je je stagevoorstel wil intrekken? Het voorstel wordt niet meer beoordeeld door de stagecommissie.</p>
      {intrekFout && <p className="status s_rood" style={{ marginTop: 8 }}>{intrekFout}</p>}
    </Modal>
    </>
  );
}
