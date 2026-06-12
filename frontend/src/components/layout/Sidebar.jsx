import "./Sidebar.css";
import { NavLink } from "react-router-dom";
import stageifyLogo from "../../assets/stageify-logo/stageify_logo_wide.png";
import stageifyIcon from "../../assets/stageify-logo/stageify_original.png";
import ehbLogoWide from "../../assets/ehb-logo/erasmus_wide_version.png";
import ehbLogoSmall from "../../assets/ehb-logo/erasmus_logo_black.png";
import { NAVIGATION } from "../../constants/navigation";
import { useAuth } from "../../context/AuthContext";

export default function Sidebar({ collapsed }) {
  const { user } = useAuth();
  const items = NAVIGATION[user.role] || [];
  const initials = user.name
    ? user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

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
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          >
            <i className={`ti ${item.icon}`}></i>
            <span className="label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer: EHB logo */}
      <div className="sidebar-footer">
        <img src={ehbLogoWide} alt="Erasmushogeschool Brussel" className="ehb-logo ehb-logo-wide" />
        <img src={ehbLogoSmall} alt="Erasmushogeschool Brussel" className="ehb-logo ehb-logo-small" />
      </div>
    </aside>
  );
}
