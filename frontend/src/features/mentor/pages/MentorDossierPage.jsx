import { Fragment, useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import "./MentorDossierPage.css";
import { cacheGet, cacheSet, cacheDelete } from "../mentorCache";
import { kiesMentorStagiair, onthoudMentorDossier } from "../mentorSelection";

function initialen(naam) {
  const p = (naam || "").trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "?";
}
function dat(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("nl-BE");
}
function datTijd(value) {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleDateString("nl-BE", { day: "2-digit", month: "long", year: "numeric" }) +
    " · " + d.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
}
function contractBadge(c) {
  const s = c.status;
  if (s === "geregistreerd") return { cls: "s_ok", icon: "ti-shield-check", txt: "Geregistreerd" };
  if (s === "in_controle_bij_administratie") return { cls: "s_amber", icon: "ti-shield", txt: "In controle bij administratie" };
  if (c.bedrijf_getekend_op) return { cls: "s_ok", icon: "ti-check", txt: "Door jou getekend" };
  if (c.student_getekend_op) return { cls: "s_rood", icon: "ti-signature", txt: "Jouw handtekening nodig" };
  return { cls: "s_info", icon: "ti-hourglass", txt: "Wacht op student" };
}
function bezoekBadge(status) {
  if (status === "bevestigd") return { cls: "s_ok", icon: "ti-check", txt: "Bevestigd door jou" };
  if (status === "alternatief_gevraagd") return { cls: "s_amber", icon: "ti-hourglass", txt: "Nieuw moment gevraagd" };
  if (status === "gegeven") return { cls: "s_ok", icon: "ti-check", txt: "Heeft plaatsgevonden" };
  if (status === "geannuleerd") return { cls: "s_rood", icon: "ti-x", txt: "Geannuleerd" };
  return { cls: "s_rood", icon: "ti-hourglass", txt: "Te bevestigen" };
}
function typeLabel(type) {
  if (type === "bedrijfsbezoek") return "Bedrijfsbezoek";
  if (type === "tussentijdse_bespreking") return "Tussentijdse bespreking";
  if (type === "eindpresentatie") return "Eindpresentatie";
  return "Afspraak";
}

// Stepper: Contract / Voorbereiding (praktische afspraken) / Stage / Evaluatie.
function getStappen(contract, gedeeldOp, dossierStatus) {
  const contractKlaar = contract?.status === "geregistreerd";
  const stageAfgerond = ["afgerond", "voltooid", "resultaat_vrijgegeven"].includes(dossierStatus);
  const stageLoopt = dossierStatus === "stage_loopt";
  const evalVrijgegeven = dossierStatus === "resultaat_vrijgegeven";

  return [
    {
      label: "Contract",
      sub: contractKlaar ? "Geregistreerd" : contract ? "Wacht op ondertekening/registratie" : "Nog niet opgemaakt",
      state: contractKlaar ? "done" : "actief",
    },
    {
      label: "Voorbereiding",
      sub: gedeeldOp ? "Gedeeld" : "Nog niet gedeeld",
      state: gedeeldOp ? "done" : contractKlaar ? "actief" : "todo",
    },
    {
      label: "Stage",
      sub: stageAfgerond ? "Afgerond" : stageLoopt ? "Loopt" : "Nog niet gestart",
      state: stageAfgerond ? "done" : stageLoopt ? "actief" : "todo",
    },
    {
      label: "Evaluatie",
      sub: evalVrijgegeven ? "Vrijgegeven" : stageAfgerond ? "Loopt" : "—",
      state: evalVrijgegeven ? "done" : stageAfgerond ? "actief" : "todo",
    },
  ];
}

export default function MentorDossierPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const vSt = Number(searchParams.get("student")) || null;
  const vDos = Number(searchParams.get("dossier")) || null;

  const [student, setStudent] = useState(null);
  const [dossierId, setDossierId] = useState(vDos);
  const [contract, setContract] = useState(null);
  const [afspraken, setAfspraken] = useState("");
  const [gedeeldOp, setGedeeldOp] = useState(null);
  const [momenten, setMomenten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [bezigTeken, setBezigTeken] = useState(false);
  const [editAfspraken, setEditAfspraken] = useState(false);
  const [afsprakenWaarde, setAfsprakenWaarde] = useState("");
  const [bezigAfspraken, setBezigAfspraken] = useState(false);
  const [melding, setMelding] = useState({ tekst: "", type: "" });
  const [altOpen, setAltOpen] = useState(null);
  const [altTekst, setAltTekst] = useState("");
  const [bezigMoment, setBezigMoment] = useState(null);
  const [dossierOpen, setDossierOpen] = useState(false);

  const H = {};

  useEffect(() => {
    async function init() {
      const cached = cacheGet("mentor_students");
      if (cached) {
        const gekozen = kiesMentorStagiair(cached, searchParams);
        setStudent(gekozen);
        setDossierId(gekozen?.dossier_id ?? vDos);
        onthoudMentorDossier(gekozen?.dossier_id);
        return;
      }
      try {
        const res = await api.get("/mentor/students");
        const lijst = res.data.data || [];
        cacheSet("mentor_students", lijst);
        const gekozen = kiesMentorStagiair(lijst, searchParams);
        setStudent(gekozen);
        setDossierId(gekozen?.dossier_id ?? vDos);
        onthoudMentorDossier(gekozen?.dossier_id);
      } catch (err) {
        setError(err.response?.data?.message || "Stagiair ophalen mislukt");
        setLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!dossierId) return;
    async function load() {
      const cachedC = cacheGet(`mentor_contract_${dossierId}`);
      const cachedA = cacheGet(`mentor_afspraken_${dossierId}`);
      const cachedP = cacheGet(`mentor_planning_${dossierId}`);
      if (cachedC !== null && cachedA !== null && cachedP !== null) {
        setContract(cachedC);
        setAfspraken(cachedA.tekst || "");
        setGedeeldOp(cachedA.gedeeldOp || null);
        setMomenten(cachedP);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [c, a, p] = await Promise.allSettled([
          api.get(`/mentor/contract/${dossierId}`),
          api.get(`/mentor/dossier/${dossierId}/afspraken`),
          api.get(`/mentor/planning/${dossierId}`),
        ]);
        const contractData = c.status === "fulfilled" ? c.value.data.data : null;
        cacheSet(`mentor_contract_${dossierId}`, contractData);
        setContract(contractData);
        if (a.status === "fulfilled") {
          const row = a.value.data.data;
          const tekst = row?.praktische_afspraken || "";
          const gedeeld = row?.praktische_afspraken_gedeeld_op || null;
          cacheSet(`mentor_afspraken_${dossierId}`, { tekst, gedeeldOp: gedeeld });
          setAfspraken(tekst);
          setGedeeldOp(gedeeld);
        }
        const momentenData = p.status === "fulfilled" ? (p.value.data.data || []) : [];
        cacheSet(`mentor_planning_${dossierId}`, momentenData);
        setMomenten(momentenData);
      } catch (err) {
        setError(err.response?.data?.message || "Dossier laden mislukt");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dossierId]);

  async function herlaad() {
    cacheDelete(`mentor_contract_${dossierId}`, `mentor_afspraken_${dossierId}`, `mentor_planning_${dossierId}`);
    const [c, a, p] = await Promise.allSettled([
      api.get(`/mentor/contract/${dossierId}`),
      api.get(`/mentor/dossier/${dossierId}/afspraken`),
      api.get(`/mentor/planning/${dossierId}`),
    ]);
    const contractData = c.status === "fulfilled" ? c.value.data.data : null;
    cacheSet(`mentor_contract_${dossierId}`, contractData);
    setContract(contractData);
    if (a.status === "fulfilled") {
      const row = a.value.data.data;
      const tekst = row?.praktische_afspraken || "";
      const gedeeld = row?.praktische_afspraken_gedeeld_op || null;
      cacheSet(`mentor_afspraken_${dossierId}`, { tekst, gedeeldOp: gedeeld });
      setAfspraken(tekst);
      setGedeeldOp(gedeeld);
    }
    const momentenData = p.status === "fulfilled" ? (p.value.data.data || []) : [];
    cacheSet(`mentor_planning_${dossierId}`, momentenData);
    setMomenten(momentenData);
  }

  async function tekenContract() {
    try {
      setBezigTeken(true);
      cacheDelete(`mentor_contract_${dossierId}`, "mentor_students");
      await api.patch(`/mentor/contract/${dossierId}/teken`, { tekenbevoegd: true });
      await herlaad();
      setMelding({ tekst: "Stageovereenkomst ondertekend.", type: "s_ok" });
    } catch (err) {
      setMelding({ tekst: err.response?.data?.message || "Tekenen mislukt", type: "s_rood" });
    } finally {
      setBezigTeken(false);
    }
  }

  async function deelAfspraken() {
    if (!afsprakenWaarde.trim()) {
      setMelding({ tekst: "Vul eerst afspraken in voor je ze deelt.", type: "s_amber" });
      return;
    }
    try {
      setBezigAfspraken(true);
      await api.patch(`/mentor/dossier/${dossierId}/afspraken`, { afspraken: afsprakenWaarde });
      cacheDelete(`mentor_afspraken_${dossierId}`);
      const nu = new Date().toISOString();
      cacheSet(`mentor_afspraken_${dossierId}`, { tekst: afsprakenWaarde, gedeeldOp: nu, velden: null });
      setAfspraken(afsprakenWaarde);
      setGedeeldOp(nu);
      setEditAfspraken(false);
      setMelding({ tekst: "Praktische afspraken gedeeld met de student.", type: "s_ok" });
    } catch (err) {
      setMelding({ tekst: err.response?.data?.message || "Opslaan mislukt", type: "s_rood" });
    } finally {
      setBezigAfspraken(false);
    }
  }

  async function bevestigMoment(id) {
    try {
      setBezigMoment(id);
      await api.patch(`/mentor/planning/${id}/bevestig`, {});
      await herlaad();
    } catch (err) {
      setMelding({ tekst: err.response?.data?.message || "Bevestigen mislukt", type: "s_rood" });
    } finally {
      setBezigMoment(null);
    }
  }
  async function stelAlternatief(id) {
    if (!altTekst.trim()) return;
    try {
      setBezigMoment(id);
      await api.patch(`/mentor/planning/${id}/alternatief`, { bericht: altTekst });
      setAltOpen(null);
      setAltTekst("");
      await herlaad();
    } catch (err) {
      setMelding({ tekst: err.response?.data?.message || "Versturen mislukt", type: "s_rood" });
    } finally {
      setBezigMoment(null);
    }
  }

  const naam = student ? `${student.voornaam} ${student.achternaam}` : "Stagiair";
  const docentNaam = momenten.find((m) => m.docent_naam)?.docent_naam;

  return (
    <div className="page-inner">
        <div style={{ marginBottom: 10 }}>
          <a href="#" onClick={(e) => { e.preventDefault(); navigate("/mentor/students"); }} style={{ fontSize: 12.5, color: "var(--red)", textDecoration: "none", fontWeight: 600 }}>
            <i className="ti ti-arrow-left" /> Terug naar overzicht
          </a>
        </div>
        <div className="page-header"><h1>{naam}</h1></div>

        {loading && <div className="card"><p style={{ color: "var(--sub)", fontSize: 13 }}>Dossier laden…</p></div>}
        {error && <div className="card"><span className="status s_rood">{error}</span></div>}

        {melding.tekst && <div style={{ marginBottom: 12 }}><span className={`status ${melding.type}`}>{melding.tekst}</span></div>}

        {!loading && (
          <>
            {/* Stepper */}
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="ev-track">
                {getStappen(contract, gedeeldOp, student?.dossier_status).map((s, i, arr) => (
                  <Fragment key={s.label}>
                    <div className={`ev-stap${s.state === "actief" ? " actief" : ""}${s.state === "done" ? " done" : ""}`}>
                      <div className="ev-circle">{s.state === "done" ? <i className="ti ti-check" /> : i + 1}</div>
                      <div className="ev-label">{s.label}</div>
                      <div className="ev-sub">{s.sub}</div>
                    </div>
                    {i < arr.length - 1 && <div className="ev-lijn" />}
                  </Fragment>
                ))}
              </div>
            </div>

            {/* Contract */}
            {contract && (
              <div className="card" style={!contract.bedrijf_getekend_op && contract.student_getekend_op ? { border: "1.5px solid #0a0a0a", boxShadow: "0 4px 14px rgba(0,0,0,.10)" } : {}}>
                <div className="card_title">
                  <i className="ti ti-file-certificate" style={{ color: "var(--red)" }} />
                  Stageovereenkomst
                  <span className={`status ${contractBadge(contract).cls}`} style={{ marginLeft: 6 }}>
                    <i className={`ti ${contractBadge(contract).icon}`} />{contractBadge(contract).txt}
                  </span>
                </div>
                <div className="kv"><span className="k">Student getekend</span><span className="v">{dat(contract.student_getekend_op)}</span></div>
                <div className="kv"><span className="k">Bedrijf/mentor getekend</span><span className="v">{dat(contract.bedrijf_getekend_op)}</span></div>
                <div className="kv"><span className="k">Versie</span><span className="v">{contract.versie_nummer || 1}</span></div>
                {!contract.student_getekend_op && (
                  <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--sub)" }}>Wacht op de handtekening van de student voor je kan tekenen.</div>
                )}
                {!contract.bedrijf_getekend_op && contract.student_getekend_op && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12.5, color: "var(--sub)", lineHeight: 1.6, marginBottom: 10 }}>
                      Lees de overeenkomst na en onderteken digitaal namens het stagebedrijf. Na jouw handtekening controleert en registreert de administratie ze.
                    </div>
                    <button className="btn primary" disabled={bezigTeken} onClick={tekenContract}>
                      <i className="ti ti-signature" />{bezigTeken ? "Bezig…" : "Digitaal ondertekenen"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Praktische afspraken */}
            <div className="card">
              <div className="card_title">
                <i className="ti ti-message-circle" style={{ color: "var(--red)" }} />
                Praktische afspraken
                <span className={`status ${afspraken ? "s_ok" : "s_grijs"}`} style={{ marginLeft: 6 }}>
                  {afspraken ? <><i className="ti ti-check" />Gedeeld met de student</> : "Nog niet gedeeld"}
                </span>
              </div>
              {gedeeldOp && <div style={{ fontSize: 11.5, color: "var(--faint)", marginBottom: 8 }}>Laatst gedeeld op {dat(gedeeldOp)}</div>}
              {!editAfspraken ? (
                <>
                  <div style={{ fontSize: 13, color: afspraken ? "var(--gray)" : "var(--faint)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                    {afspraken || "Nog geen afspraken gedeeld. De student ziet ze in zijn dashboard zodra je ze deelt."}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <button className="btn primary sm" onClick={() => { setAfsprakenWaarde(afspraken); setEditAfspraken(true); }}>
                      <i className="ti ti-pencil" />{afspraken ? "Bewerken" : "Afspraken delen"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <textarea className="form_input" style={{ minHeight: 80, fontSize: 12.5 }} value={afsprakenWaarde}
                    placeholder="bv. Werkuren 9u–17u30, vrijdag thuiswerk. Meld je de eerste dag aan het onthaal."
                    onChange={(e) => setAfsprakenWaarde(e.target.value)} />
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button className="btn primary sm" disabled={bezigAfspraken || !afsprakenWaarde.trim()} onClick={deelAfspraken}><i className="ti ti-send" />Deel met de student</button>
                    <button className="btn sm" onClick={() => setEditAfspraken(false)}>Annuleer</button>
                  </div>
                </>
              )}
            </div>

            {/* Bedrijfsbezoek / planning */}
            {momenten.map((m) => {
              const bb = bezoekBadge(m.status);
              const teBevestigen = m.type === "bedrijfsbezoek" && ["voorgesteld", "gepland"].includes(m.status);
              return (
                <div className="card" key={m.id} style={teBevestigen ? { borderLeft: "3px solid var(--red)" } : {}}>
                  <div className="card_title">
                    <i className="ti ti-calendar" style={{ color: "var(--red)" }} />
                    {typeLabel(m.type)}
                    <span className={`status ${bb.cls}`} style={{ marginLeft: 6 }}><i className={`ti ${bb.icon}`} />{bb.txt}</span>
                  </div>
                  <div className="kv"><span className="k">Wanneer</span><span className="v">{datTijd(m.gepland_op)}</span></div>
                  {m.locatie && <div className="kv"><span className="k">Waar</span><span className="v">{m.locatie}</span></div>}
                  {m.voorgesteld_door_naam && <div className="kv"><span className="k">Voorgesteld door</span><span className="v">{m.voorgesteld_door_naam}</span></div>}
                  {m.alternatief_voorstel && <div className="kv"><span className="k">Jouw voorstel</span><span className="v" style={{ fontStyle: "italic" }}>"{m.alternatief_voorstel}"</span></div>}
                  {teBevestigen && (
                    altOpen === m.id ? (
                      <div style={{ marginTop: 12 }}>
                        <label className="form_label">Bericht / alternatief moment</label>
                        <textarea className="form_input" style={{ minHeight: 60 }} value={altTekst} onChange={(e) => setAltTekst(e.target.value)}
                          placeholder="bv. Die voormiddag zit ik in een klantmeeting — kan het in de namiddag?" />
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button className="btn primary sm" disabled={bezigMoment === m.id || !altTekst.trim()} onClick={() => stelAlternatief(m.id)}><i className="ti ti-send" />Versturen</button>
                          <button className="btn sm" onClick={() => setAltOpen(null)}>Annuleer</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <button className="btn primary sm" disabled={bezigMoment === m.id} onClick={() => bevestigMoment(m.id)}><i className="ti ti-check" />Bevestigen</button>
                        <button className="btn sm" onClick={() => { setAltOpen(m.id); setAltTekst(""); }}><i className="ti ti-calendar-x" />Ander moment voorstellen</button>
                      </div>
                    )
                  )}
                </div>
              );
            })}

            {/* Rol */}
            <div className="card">
              <div className="card_title"><i className="ti ti-shield-check" style={{ color: "var(--red)" }} />Jouw rol als stagementor</div>
              <div style={{ fontSize: 12.5, color: "var(--sub)", lineHeight: 1.65 }}>
                Je kan de stageovereenkomst namens het stagebedrijf ondertekenen, praktische afspraken delen, logboeken inkijken en wekelijks afchecken, feedback geven en mentorinput invullen. Administratieve registratie, finale beoordeling en resultaatvrijgave gebeuren door de opleiding.
              </div>
            </div>

            {/* Uitklapbaar stagedossier */}
            {student && (
              <div className="dossier">
                <button className={`dossier-kop ${dossierOpen ? "open" : ""}`} onClick={() => setDossierOpen((v) => !v)}>
                  <i className="ti ti-chevron-right" />Stagedossier — stage en betrokkenen
                </button>
                <div className={`dossier-body ${dossierOpen ? "open" : ""}`}>
                  <div className="grid-2c">
                    <div className="card">
                      <div className="card_title"><i className="ti ti-briefcase" style={{ color: "var(--red)" }} />Stage</div>
                      <div className="kv"><span className="k">Bedrijf</span><span className="v">{student.bedrijf || "-"}</span></div>
                      <div className="kv"><span className="k">Studentennummer</span><span className="v">{student.studentennummer || "-"}</span></div>
                      <div className="kv"><span className="k">Dossier</span><span className="v">#{student.dossier_id}</span></div>
                    </div>
                    <div className="card">
                      <div className="card_title"><i className="ti ti-users" style={{ color: "var(--red)" }} />Betrokkenen</div>
                      <div className="prof">
                        <div className="prof-av">{initialen(naam)}</div>
                        <div style={{ minWidth: 0 }}><div className="p-naam">{naam} <span className="tag">student</span></div></div>
                      </div>
                      {docentNaam && (
                        <div className="prof">
                          <div className="prof-av" style={{ background: "#0a0a0a" }}>{initialen(docentNaam)}</div>
                          <div style={{ minWidth: 0 }}><div className="p-naam">{docentNaam} <span className="tag">docent</span></div></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
    </div>
  );
}
