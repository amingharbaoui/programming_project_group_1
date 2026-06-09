import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function LoginPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

      function handleLogin(e) {
    e.preventDefault();
    navigate("/student");
  }
  return (

    <div className="login-page">
      <div className="login-card">


        {/* Hier moet ik nog de foto toevoegen */}

        <div className="login-subtitle">
          Stage Monitoring Tool · Erasmushogeschool Brussel
        </div>

        
        <form onSubmit={handleLogin}>
        <div className="form-group">
          <label className="form-label">
            E-mailadres<span className="req">*</span>
          </label>
          <input
            className = "form-input"
            type="email"
            placeholder="voornaam.naam@student.ehb.be"
            value={email}
            onChange={(e)=> setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            Wachtwoord<span className="req">*</span>
          </label>
          <input
          className="form-input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e)=> setPassword(e.target.value)}
            required
          />
        </div>

        <button className="btn primary login-btn">
          <i className="ti ti-login-2" />
          Aanmelden
        </button>
        </form>

        <div className="login-divider">
          <span className="login-divider-line" />
          <span className="login-divider-text">of</span>
          <span className="login-divider-line" />
        </div>

        <button className="login-btn">
          <i className="ti ti-school" />
          Aanmelden met je EhB-account
        </button>

        <div className="login-version">
          Stagify · versie 1.0 (prototype)
        </div>

      </div>
    </div>
  );
}
