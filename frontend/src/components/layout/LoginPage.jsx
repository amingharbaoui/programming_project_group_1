import React from "react";
import { IconLogin2 } from "@tabler/icons-react";
import "./LoginPage.css";
import { useNavigate } from "react-router-dom";
import logoWide from "../../assets/stageify-logo/stageify_logo_wide.png";

export default function LoginPage() {
  const navigate = useNavigate();

  // Na inloggen gaat de student naar zijn stage pagina
  function handleLogin(e) {
    e.preventDefault();
    navigate("/student/internship");
  }

  // EhB SSO knop doet hetzelfde voor nu
  function handleEhbLogin() {
    navigate("/student/internship");
  }

  return (
    <div className="login_page">
      <div className="login_card">

        {/* Logo en ondertitel */}
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

          {/* Aanmelden knop */}
          <button type="submit" className="btn primary login_btn">
            <IconLogin2 size={16} stroke={2} style={{ marginRight: 6 }} />
            Aanmelden
          </button>

          <div className="login_divider">
            <span>of</span>
          </div>

          {/* EhB SSO knop - wordt later gekoppeld aan de echte SSO */}
          <button type="button" className="btn login_secondary_btn" onClick={handleEhbLogin}>
            Aanmelden met je EhB-account
          </button>

        </form>

        <p className="login_footer">Stagify · versie 1.0</p>
      </div>
    </div>
  );
}