import "./Sidebar.css";
import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import stageifyLogo from "../../assets/stageify-logo/stageify_logo_wide.png";
import stageifyIcon from "../../assets/stageify-logo/stageify_original.png";
import ehbLogoWide from "../../assets/ehb-logo/erasmus_wide_version.png";
import ehbLogoSmall from "../../assets/ehb-logo/erasmus_logo_black.png";
import { NAVIGATION } from "../../constants/navigation";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";

// Statuses waarbij stageovereenkomst + documenten ontgrendeld zijn
const UNLOCK_CONTRACT_DOCS = ["goedgekeurd"];

// Fase-info per voorstel status
const FASE_MAP = {
  geen:          { idx: 1, naam: "Voorstel",      actie: "Dien je stagevoorstel in om te starten." },
  concept:       { idx: 1, naam: "Voorstel",      actie: "Je concept staat klaar — werk het af en dien in." },
  ingediend:     { idx: 2, naam: "Beoordeling",   actie: "Beslissing volgt op de commissievergadering." },
  aanpassingen:  { idx: 2, naam: "Beoordeling",   actie: "De commissie vraagt aanpassingen. Dien opnieuw in." },
  heringediend:  { idx: 2, naam: "Beoordeling",   actie: "Je aangepast voorstel is heringediend." },
  afgekeurd:     { idx: 2, naam: "Beoordeling",   actie: "Je stagevoorstel werd afgekeurd." },
  ingetrokken:   { idx: 1, naam: "Voorstel",      actie: "Je stagevoorstel werd ingetrokken." },
  goedgekeurd:   { idx: 3, naam: "Overeenkomst",  actie: "Onderteken je stageovereenkomst digitaal." },
  teruggestuurd: { idx: 3, naam: "Overeenkomst",  actie: "Het stagebedrijf werd uitgenodigd om te tekenen." },
  validatie:     { idx: 3, naam: "Overeenkomst",  actie: "De overeenkomst is in controle bij de administratie." },
  startklaar:    { idx: 4, naam: "Stage",          actie: "Je stage start binnenkort — logboek opent dan." },
  gestart:       { idx: 4, naam: "Stage loopt",   actie: "Vul je logboek van vandaag in." },
  lopend:        { idx: 4, naam: "Stage loopt",   actie: "Logboek van vandaag nog niet ingevuld." },
  presentatie:   { idx: 4, naam: "Evaluatie",     actie: "Bereid je eindpresentatie voor." },
  afgerond:      { idx: 5, naam: "Afgerond",      actie: "Je eindresultaat staat klaar bij Evaluatie." },
};

// Statuses waarbij het nav-item een warn-cirkel krijgt
const WARN_STATUS = {
  aanpassingen:  ["/student/application"],
  afgekeurd:     ["/student/application"],
  ingetrokken:   ["/student/application"],
  goedgekeurd:   ["/student/contract", "/student/documents"],
  teruggestuurd: ["/student/documents"],
  validatie:     ["/student/documents"],
};

export default function Sidebar({ collapsed }) {
  const { user } = useAuth();
  const items = NAVIGATION[user.role] || [];

  // Start volledig locked voor studenten, leeg (geen lock) voor andere rollen
  const [lockedGroups, setLockedGroups] = useState(
    user.role === "student"
      ? new Set(["contract_docs", "logboek_eval"])
      : new Set()
  );
  const [faseInfo, setFaseInfo] = useState(null);
  const [warnPaths, setWarnPaths] = useState(new Set());

  useEffect(() => {
    if (user.role !== "student") return;

    async function fetchLockState() {
      const locked = new Set(["contract_docs", "logboek_eval"]);

      const [internshipRes, contractRes] = await Promise.allSettled([
        apiRequest("GET", "/internships/my"),
        apiRequest("GET", "/contracts/my"),
      ]);

      // Unlock overeenkomst + documenten als voorstel goedgekeurd is
      if (internshipRes.status === "fulfilled") {
        const voorstel = internshipRes.value?.data;
        const status = voorstel?.status ?? "geen";
        if (voorstel && UNLOCK_CONTRACT_DOCS.includes(status)) {
          locked.delete("contract_docs");
        }
        // Fase-info voor side-status blok
        setFaseInfo(FASE_MAP[status] ?? FASE_MAP.geen);
        // Warn-cirkels op basis van internship-status
        const warn = new Set(WARN_STATUS[status] ?? []);
        // Contract-warn alleen tonen als student nog niet getekend heeft
        if (contractRes.status === "fulfilled") {
          const contract = contractRes.value?.data;
          if (!contract || contract.status !== "klaar_voor_student") {
            warn.delete("/student/contract");
          }
          // Unlock logboek + evaluatie als alle 3 partijen getekend hebben
          if (
            contract &&
            contract.student_getekend_op &&
            contract.bedrijf_getekend_op &&
            contract.opleiding_getekend_op
          ) {
            locked.delete("contract_docs");
            locked.delete("logboek_eval");
          }
        }
        setWarnPaths(warn);
      } else {
        setFaseInfo(FASE_MAP.geen);
      }

      setLockedGroups(locked);
    }

    fetchLockState();
  }, [user.role, user.id]);

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      {/* Brand */}
      <div className="brand">
        <div className="brand-full">
          <img src={stageifyLogo} alt="Stageify" className="brand-logo" />
        </div>
        <div className="brand-compact">
          <img src={stageifyIcon} alt="Stageify" className="brand-icon-img" />
        </div>
      </div>

      {/* Navigatie */}
      <nav className="sidebar-nav">
        {items.map((item) => {
          const isLocked = item.lockGroup && lockedGroups.has(item.lockGroup);
          const hasWarn  = warnPaths.has(item.path);

          if (isLocked) {
            return (
              <div
                key={item.path}
                className="nav-item locked"
                title={
                  item.lockGroup === "contract_docs"
                    ? "Beschikbaar na goedkeuring stagevoorstel"
                    : "Beschikbaar zodra stage loopt"
                }
              >
                <i className={`ti ${item.icon}`}></i>
                <span className="label">{item.label}</span>
                <i className="ti ti-lock lock"></i>
              </div>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
            >
              <i className={`ti ${item.icon}`}></i>
              <span className="label">{item.label}</span>
              {hasWarn && <span className="nav-warn">!</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Side-status blok (alleen voor student, boven EHB logo) */}
      {user.role === "student" && faseInfo && (
        <div className="side-status">
          <div className="fase">Fase {faseInfo.idx} van 5</div>
          <div className="fase-naam">{faseInfo.naam}</div>
          <div className="volgende">
            <i className="ti ti-corner-down-right"></i>
            <span>{faseInfo.actie}</span>
          </div>
          <div className="side-prog">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className={n <= faseInfo.idx ? "done" : ""}></span>
            ))}
          </div>
        </div>
      )}

      {/* Footer: EHB logo */}
      <div className="sidebar-footer">
        <img src={ehbLogoWide} alt="Erasmushogeschool Brussel" className="ehb-logo ehb-logo-wide" />
        <img src={ehbLogoSmall} alt="Erasmushogeschool Brussel" className="ehb-logo ehb-logo-small" />
      </div>
    </aside>
  );
}
