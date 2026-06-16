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

export default function Sidebar({ collapsed }) {
  const { user } = useAuth();
  const items = NAVIGATION[user.role] || [];

  // Start volledig locked voor studenten, leeg (geen lock) voor andere rollen
  const [lockedGroups, setLockedGroups] = useState(
    user.role === "student"
      ? new Set(["contract_docs", "logboek_eval"])
      : new Set()
  );

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
        if (voorstel && UNLOCK_CONTRACT_DOCS.includes(voorstel.status)) {
          locked.delete("contract_docs");
        }
      }

      // Unlock logboek + evaluatie als alle 3 partijen getekend hebben
      if (contractRes.status === "fulfilled") {
        const contract = contractRes.value?.data;
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
            </NavLink>
          );
        })}
      </nav>

      {/* Footer: EHB logo */}
      <div className="sidebar-footer">
        <img src={ehbLogoWide} alt="Erasmushogeschool Brussel" className="ehb-logo ehb-logo-wide" />
        <img src={ehbLogoSmall} alt="Erasmushogeschool Brussel" className="ehb-logo ehb-logo-small" />
      </div>
    </aside>
  );
}
