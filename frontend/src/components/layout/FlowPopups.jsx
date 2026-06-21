import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../ui/Modal";
import api, { apiRequest } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

function formatMoment(v) {
  if (!v) return "Nog niet gepland";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function seenKey(userId, item) {
  return `flow_popup_seen_${userId}_${item.key}`;
}

function wasSeen(userId, item) {
  try {
    return sessionStorage.getItem(seenKey(userId, item)) === "1";
  } catch {
    return false;
  }
}

function markSeen(userId, item) {
  try {
    sessionStorage.setItem(seenKey(userId, item), "1");
  } catch {
    /* ignore */
  }
}

export default function FlowPopups() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadStudentPopups() {
      const found = [];

      try {
        const planning = (await apiRequest("GET", "/planning/my", null, { skipAuthRedirect: true })).data ?? [];
        for (const m of planning) {
          if (!["bedrijfsbezoek", "eindpresentatie"].includes(m.type) || m.status !== "bevestigd") continue;
          const isPres = m.type === "eindpresentatie";
          found.push({
            key: `planning_${m.id}_${m.status}`,
            icon: isPres ? "ti-presentation" : "ti-calendar-event",
            title: isPres ? "Eindpresentatie ingepland" : "Bedrijfsbezoek ingepland",
            sub: isPres ? "Finale evaluatie" : "Tussentijdse evaluatie",
            body: (
              <>
                <div className="card" style={{ marginBottom: 10 }}>
                  <p style={{ margin: "2px 0" }}><strong>Wanneer:</strong> {formatMoment(m.gepland_op)}</p>
                  <p style={{ margin: "2px 0" }}><strong>Waar:</strong> {m.locatie || "-"}</p>
                </div>
                <p>
                  {isPres
                    ? "Vul je finale zelfevaluatie uiterlijk 1 week voor de presentatie in. Niet ingevuld telt als 0."
                    : "Je docent bespreekt dan je voortgang samen met je mentor. Hou je logboek en tussentijdse zelfevaluatie up-to-date."}
                </p>
              </>
            ),
            primary: { label: "Begrepen" },
          });
        }
      } catch {
        /* achtergrondpopup mag de pagina niet breken */
      }

      try {
        const evalData = (await apiRequest("GET", `/evaluations/${user.id}`, null, { skipAuthRedirect: true })).data;
        const tussentijds = evalData?.evaluaties?.find((e) => e.type === "tussentijds");
        if (tussentijds?.status === "geregistreerd" && (tussentijds.verslag || tussentijds.mentor_algemene_feedback)) {
          found.push({
            key: `verslag_${tussentijds.id}_${tussentijds.status}`,
            icon: "ti-file-text",
            title: "Verslag beschikbaar",
            sub: "Tussentijdse evaluatie · geregistreerd door je docent",
            body: <p>Je docent registreerde het verslag van je tussentijdse evaluatie. Je vindt het terug bij Evaluatie en Documenten.</p>,
            primary: { label: "Bekijk verslag", to: "/student/evaluation" },
            secondary: { label: "Later" },
          });
        }
      } catch {
        /* ignore */
      }

      try {
        const internship = (await apiRequest("GET", "/internships/my", null, { skipAuthRedirect: true })).data;
        if (["goedgekeurd", "geregistreerd", "stage_loopt", "resultaat_vrijgegeven"].includes(internship?.status)) {
          found.push({
            key: `proposal_${internship.id || internship.dossier_id || user.id}_${internship.status}`,
            icon: "ti-circle-check",
            title: "Voorstel goedgekeurd",
            sub: "Stagecommissie",
            body: <p>Je stagevoorstel is goedgekeurd. Volgende stap: breng je stageovereenkomst en verplichte documenten in orde.</p>,
            primary: { label: "Bekijk stage", to: "/student/internship" },
          });
        }
      } catch {
        /* ignore */
      }

      return found;
    }

    async function loadMentorPopups() {
      try {
        const planning = (await api.get("/mentor/planning", { skipAuthRedirect: true })).data.data || [];
        return planning
          .filter((m) => ["bedrijfsbezoek", "eindpresentatie"].includes(m.type) && ["voorgesteld", "gepland"].includes(m.status))
          .map((m) => {
            const isPres = m.type === "eindpresentatie";
            return {
              key: `mentor_planning_${m.id}_${m.status}`,
              icon: isPres ? "ti-presentation" : "ti-calendar",
              title: isPres ? "Eindpresentatie voorgesteld" : "Bedrijfsbezoek voorgesteld",
              sub: `${m.docent_naam || "De docent"} (docent) · voor de ${isPres ? "finale" : "tussentijdse"} evaluatie`,
              body: (
                <>
                  <div className="card" style={{ marginBottom: 10 }}>
                    <p style={{ margin: "2px 0" }}><strong>Wanneer:</strong> {formatMoment(m.gepland_op)}</p>
                    <p style={{ margin: "2px 0" }}><strong>Waar:</strong> {m.locatie || "-"}</p>
                    <p style={{ margin: "2px 0" }}><strong>Stagiair:</strong> {m.student_naam || "-"}</p>
                  </div>
                  <p>{isPres ? "Bevestig of dit moment past voor de eindpresentatie." : "Bevestig of dit moment past voor het bedrijfsbezoek."}</p>
                </>
              ),
              primary: { label: "Open planning", to: `/mentor/planning?dossier=${m.stagedossier_id}` },
              secondary: { label: "Later" },
            };
          });
      } catch {
        return [];
      }
    }

    async function load() {
      if (!user?.id) return;
      const raw = user.role === "student"
        ? await loadStudentPopups()
        : user.role === "mentor"
          ? await loadMentorPopups()
          : [];
      if (cancelled) return;
      const unseen = raw.filter((item) => !wasSeen(user.id, item));
      setItems(unseen);
      setIndex(0);
    }

    load();
    return () => { cancelled = true; };
  }, [user?.id, user?.role]);

  const current = useMemo(() => items[index] || null, [items, index]);

  if (!user || !current) return null;

  function close(item = current) {
    markSeen(user.id, item);
    setIndex((i) => i + 1);
  }

  function act(action) {
    close();
    if (action?.to) navigate(action.to);
  }

  return (
    <Modal
      open={!!current}
      onClose={() => close()}
      icon={current.icon}
      titel={current.title}
      sub={current.sub}
      footer={
        <>
          {current.secondary && <button className="btn" onClick={() => act(current.secondary)}>{current.secondary.label}</button>}
          <button className="btn primary" onClick={() => act(current.primary)}>{current.primary?.label || "Begrepen"}</button>
        </>
      }
    >
      {current.body}
    </Modal>
  );
}
