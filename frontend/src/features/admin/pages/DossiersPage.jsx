import { useEffect, useState } from "react";
import { IconEye, IconX } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import "./DossiersPage.css";
import "../../../index.css";
import api from "../../../services/api";
import { cacheGet, cacheSet } from "../adminCache";

const STATUS_LABELS = {
  wacht_op_student:              "Wacht op student",
  wacht_op_bedrijf:              "Wacht op bedrijf",
  in_controle_bij_administratie: "In controle",
  document_afgekeurd:            "Document afgekeurd",
  geregistreerd:                 "Geregistreerd",
  stage_loopt:                   "Stage loopt",
  resultaat_vrijgegeven:         "Resultaat vrijgegeven",
  afgerond:                      "Afgerond",
};

const STATUS_CLASSES = {
  wacht_op_student:              "s_amber",
  wacht_op_bedrijf:              "s_amber",
  in_controle_bij_administratie: "s_amber",
  document_afgekeurd:            "s_rood",
  geregistreerd:                 "s_ok",
  stage_loopt:                   "s_info",
  resultaat_vrijgegeven:         "s_amber",
  afgerond:                      "s_ok",
};

const NEEDS_ACTION = [
  "in_controle_bij_administratie",
  "document_afgekeurd",
  "resultaat_vrijgegeven",
];

const FILTER_OPTIES = [
  { value: "",                              label: "Alle statussen" },
  { value: "wacht_op_student",              label: "Wacht op student" },
  { value: "wacht_op_bedrijf",             label: "Wacht op bedrijf" },
  { value: "in_controle_bij_administratie", label: "In controle bij administratie" },
  { value: "document_afgekeurd",            label: "Document afgekeurd" },
  { value: "geregistreerd",                label: "Geregistreerd" },
  { value: "stage_loopt",                  label: "Stage loopt" },
  { value: "resultaat_vrijgegeven",        label: "Resultaat vrijgegeven" },
  { value: "afgerond",                     label: "Afgerond" },
];

const OVEREENKOMST_LABELS = {
  klaar_voor_student:            "Wacht op student",
  getekend_door_student:         "Getekend door student",
  wacht_op_bedrijf:              "Wacht op bedrijf",
  volledig_ondertekend:          "Volledig ondertekend",
  in_controle_bij_administratie: "In controle",
  afgekeurd:                     "Afgekeurd",
  geregistreerd:                 "Geregistreerd",
};

function studentNaam(d) {
  return `${d.student_voornaam || ""} ${d.student_achternaam || ""}`.trim();
}

function initials(naam) {
  return naam.split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function formatDossier(raw) {
  const naam = studentNaam(raw);
  const docent = `${raw.docent_voornaam || ""} ${raw.docent_achternaam || ""}`.trim();
  const inOrde = Number(raw.documenten_in_orde || 0);
  const verplicht = Number(raw.verplichte_documenten || 0);

  return {
    id: raw.id,
    ini: initials(naam),
    student: naam || "Onbekende student",
    opleiding: raw.opleiding || raw.academiejaar || "-",
    bedrijf: raw.bedrijf_naam || "-",
    begeleider: docent || "Nog niet gekoppeld",
    begeleiderSub: docent ? "Definitief gekoppeld" : "Geen koppeling",
    dossiernr: raw.dossiernummer || "-",
    overeenkomst: OVEREENKOMST_LABELS[raw.overeenkomst_status] || raw.overeenkomst_status || "-",
    documenten: verplicht > 0 ? `${inOrde}/${verplicht} in orde` : "-",
    status: raw.status,
    statusCls: STATUS_CLASSES[raw.status] || "s_amber",
    needsAction: NEEDS_ACTION.includes(raw.status),
  };
}

export default function DossiersPage() {
  const navigate = useNavigate();
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [zoek, setZoek] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => { loadDossiers(); }, []);

  async function loadDossiers() {
    try {
      setError("");
      const cached = cacheGet("admin_dossiers");
      if (cached) { setDossiers(cached); setLoading(false); return; }
      setLoading(true);
      const res = await api.get("/admin/dossiers");
      const data = res.data.data || [];
      cacheSet("admin_dossiers", data);
      setDossiers(data);
    } catch (err) {
      setError(err.response?.data?.message || "Dossiers ophalen mislukt");
    } finally {
      setLoading(false);
    }
  }

  const geformatteerd = dossiers.map(formatDossier);

  const gefilterd = geformatteerd.filter((d) => {
    const zoekLower = zoek.toLowerCase();
    const matchZoek = !zoek ||
      d.student.toLowerCase().includes(zoekLower) ||
      d.bedrijf.toLowerCase().includes(zoekLower) ||
      d.dossiernr.toLowerCase().includes(zoekLower);
    const matchStatus = !filterStatus || d.status === filterStatus;
    return matchZoek && matchStatus;
  });

  const actieTelling = geformatteerd.filter((d) => d.needsAction).length;

  return (
    <div className="page">
      <div className="page_header">
        <h1>
          Dossiers
          {actieTelling > 0 && (
            <span className="dos_badge">{actieTelling} vereist actie</span>
          )}
        </h1>
        <p>Controleer documenten, handtekeningen en administratieve dossierstatus.</p>
      </div>

      <div className="dos_filters">
        <input
          className="dos_zoek"
          placeholder="Zoek op student, bedrijf of dossiernummer..."
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
        />
        <select
          className="dos_select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          {FILTER_OPTIES.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {(filterStatus || zoek) && (
          <button className="btn sm primary" onClick={() => { setFilterStatus(""); setZoek(""); }}>
            <IconX size={16} stroke={1.8} />
            Wis filters
          </button>
        )}
      </div>

      <div className="card dossiers_card">
        <table className="tbl dossiers_tbl">
          <thead>
            <tr>
              <th>Student</th>
              <th>Stagebedrijf</th>
              <th>Stagebegeleider</th>
              <th>Stagedossier</th>
              <th>Stageovereenkomst</th>
              <th>Documenten</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actie</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="8" className="dos_state_cell">Dossiers laden...</td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan="8" className="dos_state_cell dos_error">{error}</td>
              </tr>
            )}
            {!loading && !error && gefilterd.length === 0 && (
              <tr>
                <td colSpan="8" className="dos_state_cell">
                  {geformatteerd.length === 0
                    ? "Geen stagedossiers gevonden."
                    : "Geen dossiers komen overeen met de filters."}
                </td>
              </tr>
            )}
            {!loading && !error && gefilterd.map((d) => (
              <tr key={d.id} className={d.needsAction ? "dos_row_actie" : ""}>
                <td>
                  <div className="student_cell">
                    <div className="student_avatar">{d.ini}</div>
                    <div className="student_info">
                      <div className="student_name">{d.student}</div>
                      <div className="student_meta">{d.opleiding}</div>
                    </div>
                  </div>
                </td>
                <td><div className="cell_main">{d.bedrijf}</div></td>
                <td>
                  <div className="cell_main">{d.begeleider}</div>
                  <div className="cell_sub">{d.begeleiderSub}</div>
                </td>
                <td><div className="cell_dossier">{d.dossiernr}</div></td>
                <td><div className="cell_main">{d.overeenkomst}</div></td>
                <td><div className="cell_main">{d.documenten}</div></td>
                <td>
                  <span className={`status ${d.statusCls}`}>{STATUS_LABELS[d.status] || d.status}</span>
                </td>
                        <td style={{ textAlign: "right" }}>
                  <button
                    className={d.needsAction ? "btn sm primary" : "btn sm"}
                    onClick={() => navigate(`/admin/dossiers/${d.id}`)}
                  >
                    <IconEye size={16} stroke={1.8} />
                    {d.needsAction ? "Controleren" : "Bekijken"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
