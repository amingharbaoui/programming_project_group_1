import { useEffect, useState } from "react";
import "../../../components/layout/LoginPage.css";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../../../services/api";
import logoWide from "../../../assets/stageify-logo/stageify_logo_wide.png";

// Generieke activatiepagina voor uitgenodigde docenten/admins/commissieleden
// (de mentor heeft een eigen variant op /mentor/activate). Gebruikt de generieke
// endpoints GET /invitations/:token en POST /invitations/activate.
const ROL_LABEL = {
  student: "student",
  docent: "docent",
  administratie: "administratief medewerker",
  stagecommissie: "lid van de stagecommissie",
};

export default function ActivationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tokenFout, setTokenFout] = useState("");
  const [fout, setFout] = useState("");
  const [bezig, setBezig] = useState(false);
  const [gelukt, setGelukt] = useState(false);

  const [ww1, setWw1] = useState("");
  const [ww2, setWw2] = useState("");
  const [toonWw, setToonWw] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenFout("Ongeldige activatielink. Controleer de link uit je uitnodigingsmail.");
      setLoading(false);
      return;
    }
    async function loadToken() {
      try {
        const res = await api.get(`/invitations/${token}`);
        setInfo(res.data.data);
      } catch {
        setTokenFout("Deze activatielink is ongeldig of verlopen.");
      } finally {
        setLoading(false);
      }
    }
    loadToken();
  }, [token]);

  async function handleActiveer() {
    setFout("");
    if (ww1.length < 8 || ww1 !== ww2) {
      setFout("Kies tweemaal hetzelfde wachtwoord (min. 8 tekens).");
      return;
    }
    try {
      setBezig(true);
      await api.post("/invitations/activate", { token, wachtwoord: ww1 });
      setGelukt(true);
    } catch (err) {
      setFout(err.response?.data?.message || "Activatie mislukt. Probeer opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  const rolLabel = info ? (ROL_LABEL[info.rol] || info.rol) : "";

  return (
    <div className="login_page">
      <div className="login_card">

        <div className="login_header">
          <img
            className="login_logo"
            src={logoWide}
            alt="Stagify logo"
          />
          <p className="login_subtitle">Account activeren</p>
        </div>

        {loading && (
          <p style={{ textAlign: "center", color: "var(--sub)", marginTop: "20px" }}>Laden...</p>
        )}

        {!loading && tokenFout && (
          <div style={{ marginTop: "16px" }}>
            <span className="status s_rood">{tokenFout}</span>
            <div style={{ textAlign: "center", marginTop: "14px" }}>
              <a href="/login" style={{ color: "var(--red)", fontWeight: 600, textDecoration: "none", fontSize: "12px" }}>
                Terug naar aanmelden
              </a>
            </div>
          </div>
        )}

        {!loading && info && !gelukt && (
          <div className="login_form">
            <div style={{
              fontSize: "12.5px", color: "var(--sub)", lineHeight: 1.6,
              background: "var(--muted)", borderRadius: "9px", padding: "10px 12px",
              marginBottom: "16px", marginTop: "14px"
            }}>
              <i className="ti ti-mail" style={{ marginRight: "5px", color: "var(--red)" }} />
              Je werd door de opleiding geregistreerd als <b>{rolLabel}</b> &mdash; kies hieronder
              een wachtwoord om je account te activeren.
            </div>

            <div className="form_group">
              <label className="form_label">E-mailadres</label>
              <input
                className="form_input"
                type="email"
                value={info.email || ""}
                disabled
                style={{ background: "var(--muted)", color: "var(--sub)" }}
              />
            </div>

            <div className="form_group">
              <label className="form_label">Kies een wachtwoord <span style={{ color: "var(--red)" }}>*</span></label>
              <div className="pw_wrap">
                <input
                  className="form_input pw_input"
                  type={toonWw ? "text" : "password"}
                  placeholder="min. 8 tekens"
                  value={ww1}
                  onChange={(e) => setWw1(e.target.value)}
                />
                <button type="button" className="pw_toggle" onClick={() => setToonWw((v) => !v)}
                  aria-label={toonWw ? "Wachtwoord verbergen" : "Wachtwoord tonen"}>
                  <i className={toonWw ? "ti ti-eye-off" : "ti ti-eye"} />
                </button>
              </div>
            </div>

            <div className="form_group">
              <label className="form_label">Herhaal wachtwoord <span style={{ color: "var(--red)" }}>*</span></label>
              <div className="pw_wrap">
                <input
                  className="form_input pw_input"
                  type={toonWw ? "text" : "password"}
                  placeholder="••••••••"
                  value={ww2}
                  onChange={(e) => setWw2(e.target.value)}
                />
                <button type="button" className="pw_toggle" onClick={() => setToonWw((v) => !v)}
                  aria-label={toonWw ? "Wachtwoord verbergen" : "Wachtwoord tonen"}>
                  <i className={toonWw ? "ti ti-eye-off" : "ti ti-eye"} />
                </button>
              </div>
            </div>

            {fout && (
              <div style={{ fontSize: "12px", color: "var(--red)", marginBottom: "8px" }}>{fout}</div>
            )}

            <button
              className="btn primary"
              style={{ width: "100%", justifyContent: "center", marginTop: "2px" }}
              disabled={bezig}
              onClick={handleActiveer}
            >
              <i className="ti ti-user-check" /> {bezig ? "Bezig..." : "Account activeren"}
            </button>

            <div style={{ textAlign: "center", fontSize: "12px", color: "var(--sub)", marginTop: "14px" }}>
              <a href="/login" style={{ color: "var(--red)", fontWeight: 600, textDecoration: "none" }}>
                Terug naar aanmelden
              </a>
            </div>
          </div>
        )}

        {gelukt && (
          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <span className="status s_ok" style={{ marginBottom: "16px", display: "inline-block" }}>
              <i className="ti ti-circle-check" /> Account geactiveerd!
            </span>
            <p style={{ fontSize: "12.5px", color: "var(--sub)", margin: "12px 0 16px" }}>
              Je account is klaar. Je kan nu aanmelden met je e-mailadres en wachtwoord.
            </p>
            <button
              className="btn primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => navigate("/login")}
            >
              <i className="ti ti-login-2" /> Naar aanmelden
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
