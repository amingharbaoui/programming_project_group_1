import React, { useState } from "react";
import { IconLogin2, IconEye, IconEyeOff } from "@tabler/icons-react";
import "./LoginPage.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { apiRequest } from "../../services/api";
import logoWide from "../../assets/stageify-logo/stageify_logo_wide.png";
import loginBg from "../../assets/backgrounds/login-bg.jpg";

const ROLE_ROUTES = {
  student: "/student/internship",
  stagecommissie: "/committee/applications",
  administratie: "/admin/dossiers",
  docent: "/docent/students",
  mentor: "/mentor/students",
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { loginUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [toonWw, setToonWw] = useState(false);
  const [pwFocus, setPwFocus] = useState(false);
  const [fout, setFout] = useState(null);
  const [loading, setLoading] = useState(false);

  async function login(emailWaarde) {
    setFout(null);
    setLoading(true);

    try {
      const response = await apiRequest("POST", "/auth/login", {
        email: emailWaarde.toLowerCase().trim(),
        password,
      });
      const apiUser = response.data;

      loginUser(apiUser);
      navigate(ROLE_ROUTES[apiUser.hoofdrol] || "/student/internship");
    } catch (error) {
      setFout(error.response?.data?.message || "Aanmelden mislukt.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogin(e) {
    e.preventDefault();
    login(email);
  }

  function handleEhbLogin() {
    login(email);
  }

  return (
    <div
      className="login_page login_bg"
      style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${loginBg})` }}
    >
      <div className="login_card">

        {/* Logo */}
        <div className="login_header">
          <div className="login_wrapper">
            <img
              className="login_logo"
              src={logoWide}
              alt="Stagify logo"
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
            <div className="pw_wrap">
              <input
                id="password"
                type={toonWw ? "text" : "password"}
                className="form_input login_input pw_input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPwFocus(true)}
                onBlur={() => setPwFocus(false)}
                required
              />
              {pwFocus && (
                <button
                  type="button"
                  className="pw_toggle"
                  onMouseDown={(e) => { e.preventDefault(); setToonWw((v) => !v); }}
                  aria-label={toonWw ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
                  title={toonWw ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
                >
                  {toonWw ? <IconEyeOff size={18} stroke={2} /> : <IconEye size={18} stroke={2} />}
                </button>
              )}
            </div>
          </div>

          {/* Foutmelding */}
          {fout && (
            <p style={{ fontSize: 12.5, color: "var(--red)", margin: "0 0 8px" }}>{fout}</p>
          )}

          {/* Aanmelden knop */}
          <button type="submit" className="btn primary login_btn" disabled={loading}>
            <IconLogin2 size={16} stroke={2} style={{ marginRight: 6 }} />
            {loading ? "Aanmelden..." : "Aanmelden"}
          </button>

          <div className="login_divider">
            <span>of</span>
          </div>

          {/* EhB SSO knop */}
          <button type="button" className="btn login_secondary_btn" onClick={handleEhbLogin} disabled={loading}>
            Aanmelden met je EhB-account
          </button>

        </form>
      </div>
    </div>
  );
}
