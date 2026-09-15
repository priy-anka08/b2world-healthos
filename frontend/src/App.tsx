import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "@/pages/auth/LoginPage";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import PatientsPage from "@/pages/patients/PatientsPage";
import DoctorsPage from "@/pages/admin/DoctorsPage";
import AppointmentsPage from "@/pages/appointments/AppointmentsPage";
import PharmacyPage from "@/pages/pharmacy/PharmacyPage";
import BillingPage from "@/pages/billing/BillingPage";
import LaboratoryPage from "@/pages/laboratory/LaboratoryPage";
import BedsPage from "@/pages/beds/BedsPage";
import StaffPage from "@/pages/staff/StaffPage";
import AssetsPage from "@/pages/assets/AssetsPage";
import AiToolsPage from "@/pages/ai-tools/AiToolsPage";
import PredictionsPage from "@/pages/ai-tools/PredictionsPage";
import SuppliersPage from "@/pages/suppliers/SuppliersPage";
import ReportsPage from "@/pages/reports/ReportsPage";
import DocumentsPage from "@/pages/documents/DocumentsPage";
import NotificationsPage from "@/pages/notifications/NotificationsPage";
import SubscriptionsPage from "@/pages/subscriptions/SubscriptionsPage";
import DepartmentsPage from "@/pages/departments/DepartmentsPage";
import AuditLogsPage from "@/pages/audit-logs/AuditLogsPage";
import SecuritySettingsPage from "@/pages/security/SecuritySettingsPage";
import PatientPortalPage from "@/pages/portal/PatientPortalPage";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/routes/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/appointments" element={<AppointmentsPage />} />
        <Route path="/pharmacy" element={<PharmacyPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/laboratory" element={<LaboratoryPage />} />
        <Route path="/beds" element={<BedsPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/ai-tools" element={<AiToolsPage />} />
        <Route path="/predictions" element={<PredictionsPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/subscriptions" element={<SubscriptionsPage />} />
        <Route path="/departments" element={<DepartmentsPage />} />
        <Route path="/audit-logs" element={<AuditLogsPage />} />
        <Route path="/security" element={<SecuritySettingsPage />} />
        <Route path="/portal" element={<PatientPortalPage />} />
        <Route path="/admin/doctors" element={<DoctorsPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}