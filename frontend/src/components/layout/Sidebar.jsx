import "./Sidebar.css";
import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import stageifyLogo from "../../assets/stageify-logo/stageify_logo_wide.png";
import stageifyIcon from "../../assets/stageify-logo/stageify_original.png";
import ehbLogoWide from "../../assets/ehb-logo/erasmus_wide_version.png";
import ehbLogoSmall from "../../assets/ehb-logo/erasmus_logo_black.png";
import { NAVIGATION } from "../../constants/navigation";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import { fetchStudentAccess, STUDENT_PATH_KEYS } from "../../features/student/studentAccess";

const STUDENT_KEY_PATHS = {
  stage: "/student/internship",
  overeenkomst: "/student/contract",
  documenten: "/student/documents",
  logboek: "/student/logbook",
  evaluatie: "/student/evaluation",
};

// Wanneer de stage loopt, zakken overeenkomst + documenten naar "Afgehandeld"
const AFGEHANDELD_STATUS = new Set([
  "startklaar", "gestart", "lopend", "presentatie", "afgerond",
]);
const AFGEHANDELD_PATHS = new Set(["/student/contract", "/student/documents"]);
const VERBORGEN_DOCUMENT_TYPES = new Set(["reflectiebijlage", "eindoverzicht"]);
const DOCUMENT_ACTIE_STATUSSEN = new Set(["ontbreekt", "afgekeurd"]);

function normaliseerDocumentType(waarde) {
  return String(waarde ?? "").toLowerCase();
}

function heeftDocumentActieNodig(soorten = [], documenten = []) {
  const verplichteUploadSoorten = soorten.filter((soort) => {
    const type = normaliseerDocumentType(soort.type);
    const naam = normaliseerDocumentType(soort.naam);
    // Enkel écht verplichte soorten meetellen — een optioneel documenttype mag geen rode waarschuwing geven.
    return Number(soort.is_verplicht) !== 0 &&
      type !== "stageovereenkomst" &&
      !VERBORGEN_DOCUMENT_TYPES.has(type) &&
      !VERBORGEN_DOCUMENT_TYPES.has(naam);
  });

  return verplichteUploadSoorten.some((soort) => {
    const actief = documenten
      .filter((doc) => doc.document_soort_id === soort.id)
      .sort((a, b) => (b.versie_nummer ?? 0) - (a.versie_nummer ?? 0))[0];

    return !actief || DOCUMENT_ACTIE_STATUSSEN.has(actief.status);
  });
}

export default function Sidebar({ collapsed }) {
  const { user } = useAuth();
  const location = useLocation();
  const items = NAVIGATION[user.role] || [];

  const [lockedGroups, setLockedGroups]   = useState(new Set(["contract_docs", "logboek_eval"]));
  const [faseInfo, setFaseInfo]           = useState(null);
  const [openPaths, setOpenPaths]         = useState(null);
  const [warnPaths, setWarnPaths]         = useState(new Set());
  const [dotPaths, setDotPaths]           = useState(new Set());
  const [faseStatus, setFaseStatus]       = useState(null);

  useEffect(() => {
    if (user.role !== "student") return;

    async function fetchLockState() {
      const locked = new Set(["contract_docs", "logboek_eval"]);
      const access = await fetchStudentAccess();
      const nextOpenPaths = new Set(
        Object.entries(STUDENT_PATH_KEYS)
          .filter(([, key]) => access.open.includes(key))
          .map(([path]) => path)
      );
      const warn = new Set(
        (access.warn ?? [])
          .filter((key) => key !== "documenten")
          .map((key) => STUDENT_KEY_PATHS[key])
          .filter(Boolean)
      );

      if (access.open.includes("overeenkomst") && access.open.includes("documenten")) {
        locked.delete("contract_docs");
      }
      if (access.open.includes("logboek") && access.open.includes("evaluatie")) {
        locked.delete("logboek_eval");
      }
      if (access.dot && STUDENT_KEY_PATHS[access.dot]) {
        warn.delete(STUDENT_KEY_PATHS[access.dot]);
      }

      // In de eindfase (afgerond/resultaat vrijgegeven) is een document geen openstaande taak meer.
      if (access.open.includes("documenten") && access.key !== "afgerond") {
        const [docsRes, soortenRes] = await Promise.allSettled([
          apiRequest("GET", "/documents/my", null, { skipAuthRedirect: true }),
          apiRequest("GET", "/documents/soorten", null, { skipAuthRedirect: true }),
        ]);

        if (
          docsRes.status === "fulfilled" &&
          soortenRes.status === "fulfilled" &&
          heeftDocumentActieNodig(soortenRes.value?.data ?? [], docsRes.value?.data ?? [])
        ) {
          warn.add("/student/documents");
        }
      }

      // Logboek-dot alleen tonen als de huidige week nog NIET is ingediend
      let showLogboekDot = !!(access.dot === "logboek");
      if (showLogboekDot) {
        try {
          const logRes = await apiRequest("GET", `/logbooks/${user.id}`, null, { skipAuthRedirect: true });
          const weken = Array.isArray(logRes.data) ? logRes.data : [];
          // Bereken huidige weeknummer op basis van startdatum
          const startdatum = access.startdatum ? new Date(access.startdatum) : null;
          if (startdatum) {
            const vandaag = new Date();
            const verschil = Math.floor((vandaag - startdatum) / (1000 * 60 * 60 * 24));
            const huidigeWeek = Math.max(1, Math.ceil((verschil + 1) / 7));
            const alIngediend = weken.some(
              (w) => Number(w.week_nummer) === huidigeWeek && w.status !== "ontbreekt"
            );
            if (alIngediend) showLogboekDot = false;
          }
        } catch {
          // Fout bij ophalen logboek: dot toch tonen als fallback
        }
      }

      setFaseStatus(access.key);
      setFaseInfo({ idx: access.faseIdx, naam: access.fase, actie: access.actie });
      setOpenPaths(nextOpenPaths);
      setWarnPaths(warn);
      setDotPaths(showLogboekDot ? new Set([STUDENT_KEY_PATHS["logboek"]]) : (access.dot && access.dot !== "logboek" && STUDENT_KEY_PATHS[access.dot] ? new Set([STUDENT_KEY_PATHS[access.dot]]) : new Set()));
      setLockedGroups(locked);
    }

    fetchLockState();
  }, [user.role, user.id, location.pathname]);

  // Bepaal welke items naar "Afgehandeld" zakken
  const isAfgehandeld =
    user.role === "student" &&
    !!faseStatus &&
    AFGEHANDELD_STATUS.has(faseStatus);

  const hoofdItems = items.filter(
    (item) => !isAfgehandeld || !AFGEHANDELD_PATHS.has(item.path)
  );
  const onderItems = isAfgehandeld
    ? items.filter((item) => AFGEHANDELD_PATHS.has(item.path))
    : [];

  // Helper: render één nav-item (link of locked)
  function renderNavItem(item) {
    const studentKey = STUDENT_PATH_KEYS[item.path];
    const isLocked = user.role === "student" && studentKey && openPaths
      ? !openPaths.has(item.path)
      : item.lockGroup && lockedGroups.has(item.lockGroup);
    const hasWarn  = warnPaths.has(item.path);
    const hasDot   = dotPaths.has(item.path);

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
        {!hasWarn && hasDot && <span className="nav-dot"></span>}
      </NavLink>
    );
  }

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      {/* Brand */}
      <div className="brand">
        <div className="brand-full">
          <img src={stageifyLogo} alt="Stagify" className="brand-logo" />
        </div>
        <div className="brand-compact">
          <img src={stageifyIcon} alt="Stagify" className="brand-icon-img" />
        </div>
      </div>

      {/* Navigatie */}
      <nav className="sidebar-nav">
        {hoofdItems.map(renderNavItem)}

        {/* Afgehandeld sectie — overeenkomst + documenten als stage loopt */}
        {onderItems.length > 0 && (
          <div className="nav-section">
            <div className="nav-section-label">Afgehandeld</div>
            {onderItems.map(renderNavItem)}
          </div>
        )}
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
