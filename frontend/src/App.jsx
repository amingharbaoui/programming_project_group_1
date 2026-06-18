import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AppLayout from "./components/layout/AppLayout";
import LoginPage from "./components/layout/LoginPage.jsx";
import {
  fetchStudentAccess,
  getStudentRouteLock,
  isStudentRouteOpen,
} from "./features/student/studentAccess";

import StageApplicationPage from "./features/student/pages/StageApplicationPage";
import MyInternshipPage from "./features/student/pages/MyInternshipPage";
import StudentLogbookPage from "./features/student/pages/StudentLogbookPage";
import StudentEvaluationPage from "./features/student/pages/StudentEvaluationPage";
import StudentContractPage from "./features/student/pages/StudentContractPage";
import StudentDocumentsPage from "./features/student/pages/StudentDocumentsPage";

import ApplicationsPage from "./features/committee/pages/ApplicationsPage";

import DossiersPage from "./features/admin/pages/DossiersPage";
import DossierDetailPage from "./features/admin/pages/DossierDetailPage";
import ToewijzingenPage from "./features/admin/pages/ToewijzingenPage";
import UsersPage from "./features/admin/pages/UsersPage";
import CompetenciesPage from "./features/admin/pages/CompetenciesPage";
import InstellingenPage from "./features/admin/pages/InstellingenPage";

import MentorActivationPage from "./features/mentor/pages/MentorActivationPage";
import MentorStudentsPage from "./features/mentor/pages/MentorStudentsPage";
import MentorLogbooksPage from "./features/mentor/pages/MentorLogbooksPage";
import MentorEvaluationPage from "./features/mentor/pages/MentorEvaluationPage";
import MentorContractPage from "./features/mentor/pages/MentorContractPage";
import MentorAfsprakenPage from "./features/mentor/pages/MentorAfsprakenPage";
import MentorPlanningPage from "./features/mentor/pages/MentorPlanningPage";

import DocentStudentsPage from "./features/docent/pages/DocentStudentsPage";
import DocentLogbooksPage from "./features/docent/pages/DocentLogbooksPage";
import DocentEvaluationsPage from "./features/docent/pages/DocentEvaluationsPage";
import DocentProposalsPage from "./features/docent/pages/DocentProposalsPage";
import DocentStudentDossierPage from "./features/docent/pages/DocentStudentDossierPage";
import DocentPlanningPage from "./features/docent/pages/DocentPlanningPage";

function StudentFaseGuard({ path, children }) {
  const { user } = useAuth();
  const [state, setState] = useState({
    loading: true,
    toegestaan: false,
    lock: {
      titel: "Nog niet beschikbaar",
      uitleg: "Dit onderdeel is nog niet beschikbaar in deze fase.",
    },
  });

  useEffect(() => {
    let actief = true;

    async function controleerToegang() {
      if (user.role !== "student") {
        if (actief) setState((vorige) => ({ ...vorige, loading: false, toegestaan: true }));
        return;
      }

      const access = await fetchStudentAccess();
      if (!actief) return;
      const toegestaan = isStudentRouteOpen(access, path);
      setState({
        loading: false,
        toegestaan,
        lock: getStudentRouteLock(access, path),
      });
    }

    controleerToegang();
    return () => { actief = false; };
  }, [path, user.id, user.role]);

  if (state.loading) {
    return (
      <div className="page-inner">
        <div className="page-header"><h1>Laden...</h1></div>
        <div className="card"><p style={{ fontSize: 13, color: "var(--sub)" }}>Toegang controleren...</p></div>
      </div>
    );
  }

  if (!state.toegestaan) {
    return (
      <div className="page-inner">
        <div className="page-header"><h1>{state.lock.titel}</h1></div>
        <div className="card">
          <div className="card_title" style={{ color: "var(--red)" }}>
            <i className="ti ti-lock"></i>
            Nog niet beschikbaar
          </div>
          <p style={{ fontSize: 13, color: "var(--sub)" }}>{state.lock.uitleg}</p>
        </div>
      </div>
    );
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/mentor/activate" element={<MentorActivationPage />} />

          <Route element={<AppLayout />}>
            <Route path="/student" element={<MyInternshipPage />} />
            <Route path="/student/application" element={<StageApplicationPage />} />
            <Route path="/student/internship" element={<MyInternshipPage />} />
            <Route path="/student/logbook" element={<StudentFaseGuard path="/student/logbook"><StudentLogbookPage /></StudentFaseGuard>} />
            <Route path="/student/evaluation" element={<StudentFaseGuard path="/student/evaluation"><StudentEvaluationPage /></StudentFaseGuard>} />
            <Route path="/student/contract" element={<StudentFaseGuard path="/student/contract"><StudentContractPage /></StudentFaseGuard>} />
            <Route path="/student/documents" element={<StudentFaseGuard path="/student/documents"><StudentDocumentsPage /></StudentFaseGuard>} />

            <Route path="/committee" element={<Navigate to="/committee/applications" replace />} />
            <Route path="/committee/applications" element={<ApplicationsPage />} />

            <Route path="/admin/dossiers" element={<DossiersPage />} />
            <Route path="/admin/dossiers/:id" element={<DossierDetailPage />} />
            <Route path="/admin/toewijzingen" element={<ToewijzingenPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/competencies" element={<CompetenciesPage />} />
            <Route path="/admin/instellingen" element={<InstellingenPage />} />

            <Route path="/mentor/students" element={<MentorStudentsPage />} />
            <Route path="/mentor/logbooks" element={<MentorLogbooksPage />} />
            <Route path="/mentor/evaluation" element={<MentorEvaluationPage />} />
            <Route path="/mentor/contract" element={<MentorContractPage />} />
            <Route path="/mentor/afspraken" element={<MentorAfsprakenPage />} />
            <Route path="/mentor/planning" element={<MentorPlanningPage />} />

            <Route path="/docent/students" element={<DocentStudentsPage />} />
            <Route path="/docent/students/:dossierId/dossier" element={<DocentStudentDossierPage />} />
            <Route path="/docent/proposals" element={<DocentProposalsPage />} />
            <Route path="/docent/logbooks" element={<DocentLogbooksPage />} />
            <Route path="/docent/evaluations" element={<DocentEvaluationsPage />} />
            <Route path="/docent/planning" element={<DocentPlanningPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
