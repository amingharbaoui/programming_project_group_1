import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AppLayout from "./components/layout/AppLayout";

import StudentDashboard from "./features/student/pages/StudentDashboard";
import StageApplicationPage from "./features/student/pages/StageApplicationPage";
import MyInternshipPage from "./features/student/pages/MyInternshipPage";
import StudentLogbookPage from "./features/student/pages/StudentLogbookPage";
import StudentEvaluationPage from "./features/student/pages/StudentEvaluationPage";

import CommitteeDashboard from "./features/committee/pages/CommitteeDashboard";
import ApplicationsPage from "./features/committee/pages/ApplicationsPage";

import AdminDashboard from "./features/admin/pages/AdminDashboard";
import DossiersPage from "./features/admin/pages/DossiersPage";
import UsersPage from "./features/admin/pages/UsersPage";
import CompetenciesPage from "./features/admin/pages/CompetenciesPage";

import MentorDashboard from "./features/mentor/pages/MentorDashboard";
import MentorStudentsPage from "./features/mentor/pages/MentorStudentsPage";
import MentorLogbooksPage from "./features/mentor/pages/MentorLogbooksPage";
import MentorEvaluationPage from "./features/mentor/pages/MentorEvaluationPage";

import DocentDashboard from "./features/docent/pages/DocentDashboard";
import DocentStudentsPage from "./features/docent/pages/DocentStudentsPage";
import DocentLogbooksPage from "./features/docent/pages/DocentLogbooksPage";
import DocentEvaluationsPage from "./features/docent/pages/DocentEvaluationsPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/student" replace />} />

            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/student/application" element={<StageApplicationPage />} />
            <Route path="/student/internship" element={<MyInternshipPage />} />
            <Route path="/student/logbook" element={<StudentLogbookPage />} />
            <Route path="/student/evaluation" element={<StudentEvaluationPage />} />

            <Route path="/committee" element={<CommitteeDashboard />} />
            <Route path="/committee/applications" element={<ApplicationsPage />} />

            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/dossiers" element={<DossiersPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/competencies" element={<CompetenciesPage />} />

            <Route path="/mentor" element={<MentorDashboard />} />
            <Route path="/mentor/students" element={<MentorStudentsPage />} />
            <Route path="/mentor/logbooks" element={<MentorLogbooksPage />} />
            <Route path="/mentor/evaluation" element={<MentorEvaluationPage />} />

            <Route path="/docent" element={<DocentDashboard />} />
            <Route path="/docent/students" element={<DocentStudentsPage />} />
            <Route path="/docent/logbooks" element={<DocentLogbooksPage />} />
            <Route path="/docent/evaluations" element={<DocentEvaluationsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
