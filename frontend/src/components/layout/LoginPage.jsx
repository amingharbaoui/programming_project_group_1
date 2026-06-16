import React, { useState } from "react";
import "./LoginPage.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import logoWide from "../../assets/stageify-logo/stageify_logo_wide.png";

// Accounts uit de database gekoppeld aan demo-gebruikers en routes
const ACCOUNT_MAP = {
  "student@ehb.be":    { userKey: "student",        route: "/student/internship" },
  "student2@ehb.be":   { userKey: "student2",       route: "/student/internship" },
  "student3@ehb.be":   { userKey: "student3",       route: "/student/internship" },
  "student4@ehb.be":   { userKey: "student4",       route: "/student/internship" },
  "commissie@ehb.be":  { userKey: "stagecommissie", route: "/committee/applications" },
  "admin@ehb.be":      { userKey: "administratie",  route: "/admin/dossiers" },
  "docent@ehb.be":     { userKey: "docent",         route: "/docent/students" },
  "mentor@bedrijf.be": { userKey: "mentor",         route: "/mentor/students" },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { switchRole } = useAuth();
  const [email, setEmail] = useState("");
  const [fout, setFout] = useState(null);

  function login(emailWaarde) {
    const account = ACCOUNT_MAP[emailWaarde.toLowerCase().trim()];
    if (!account) {
      setFout("Onbekend e-mailadres. Gebruik een geldig demo-account.");
      return false;
    }
    switchRole(account.userKey);
    navigate(account.route);
    return true;
  }

  function handleLogin(e) {
    e.preventDefault();
    login(email);
  }

  function handleEhbLogin() {
    login(email);
  }

  return (
    <div className="login_page">
      <div className="login_card">

        {/* Logo */}
        <div className="login_header">
          <div className="login_wrapper">
            <img
              className="login_logo"
              src={logoWide}
              alt="Stageify logo"
            />
          </div>
        </div>

        {/* Inlogformulier */}
        <form className="login_form" onSubmit={handleLogin}>

          {/* E-mailadres */}
          <div className="form_group">
            <label className="form_label" htmlFor="email">
              E-mailadres <span className="required">*</span>
            </label>
            <input
              id="email"
              type="email"
              className="form_input login_input"
              placeholder="voornaam.naam@student.ehb.be"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFout(null); }}
              required
            />
          </div>

          {/* Wachtwoord */}
          <div className="form_group">
            <label className="form_label" htmlFor="password">
              Wachtwoord <span className="required">*</span>
            </label>
            <input
              id="password"
              type="password"
              className="form_input login_input"
              placeholder="••••••••"
              required
            />
          </div>

          {/* Foutmelding */}
          {fout && (
            <p style={{ fontSize: 12.5, color: "var(--red)", margin: "0 0 8px" }}>{fout}</p>
          )}

          {/* Aanmelden knop */}
          <button type="submit" className="btn primary login_btn">
            Aanmelden
          </button>

          <div className="login_divider">
            <span>of</span>
          </div>

          {/* EhB SSO knop */}
          <button type="button" className="btn login_secondary_btn" onClick={handleEhbLogin}>
            Aanmelden met je EhB-account
          </button>

        </form>

        <p className="login_footer">Stagify · versie 1.0</p>
      </div>
    </div>
  );
}
