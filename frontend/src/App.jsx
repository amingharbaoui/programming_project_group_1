import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AppLayout from "./components/layout/AppLayout";
import MentorLayout from "./features/mentor/MentorLayout";
import LoginPage from "./components/layout/LoginPage.jsx";

import StageApplicationPage from "./features/student/pages/StageApplicationPage";
import MyInternshipPage from "./features/student/pages/MyInternshipPage";
import StudentLogbookPage from "./features/student/pages/StudentLogbookPage";
import StudentEvaluationPage from "./features/student/pages/StudentEvaluationPage";
import StudentContractPage from "./features/student/pages/StudentContractPage";
import StudentDocumentsPage from "./features/student/pages/StudentDocumentsPage";

import ApplicationsPage from "./features/committee/pages/ApplicationsPage";

import DossiersPage from "./features/admin/pages/DossiersPage";
import UsersPage from "./features/admin/pages/UsersPage";
import CompetenciesPage from "./features/admin/pages/CompetenciesPage";

import MentorActivationPage from "./features/mentor/pages/MentorActivationPage";
import MentorStudentsPage from "./features/mentor/pages/MentorStudentsPage";
import MentorDossierPage from "./features/mentor/pages/MentorDossierPage";
import MentorLogbooksPage from "./features/mentor/pages/MentorLogbooksPage";
import MentorEvaluationPage from "./features/mentor/pages/MentorEvaluationPage";
import MentorContractPage from "./features/mentor/pages/MentorContractPage";
import MentorAfsprakenPage from "./features/mentor/pages/MentorAfsprakenPage";
import MentorPlanningPage from "./features/mentor/pages/MentorPlanningPage";

import DocentStudentsPage from "./features/docent/pages/DocentStudentsPage";
import DocentLogbooksPage from "./features/docent/pages/DocentLogbooksPage";
import DocentEvaluationsPage from "./features/docent/pages/DocentEvaluationsPage";

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
            <Route path="/student/logbook" element={<StudentLogbookPage />} />
            <Route path="/student/evaluation" element={<StudentEvaluationPage />} />
            <Route path="/student/contract" element={<StudentContractPage />} />
            <Route path="/student/documents" element={<StudentDocumentsPage />} />

            <Route path="/committee" element={<Navigate to="/committee/applications" replace />} />
            <Route path="/committee/applications" element={<ApplicationsPage />} />

            <Route path="/admin/dossiers" element={<DossiersPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/competencies" element={<CompetenciesPage />} />

            <Route path="/docent/students" element={<DocentStudentsPage />} />
            <Route path="/docent/logbooks" element={<DocentLogbooksPage />} />
            <Route path="/docent/evaluations" element={<DocentEvaluationsPage />} />
          </Route>

          <Route element={<MentorLayout />}>
            <Route path="/mentor/students" element={<MentorStudentsPage />} />
            <Route path="/mentor/dossier" element={<MentorDossierPage />} />
            <Route path="/mentor/logbooks" element={<MentorLogbooksPage />} />
            <Route path="/mentor/evaluation" element={<MentorEvaluationPage />} />
            <Route path="/mentor/contract" element={<MentorContractPage />} />
            <Route path="/mentor/afspraken" element={<MentorAfsprakenPage />} />
            <Route path="/mentor/planning" element={<MentorPlanningPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
