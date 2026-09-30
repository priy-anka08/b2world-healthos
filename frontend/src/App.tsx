import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
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
import DocumentOCRPage from "@/pages/ai-tools/DocumentOCRPage";
import RAGAssistantPage from "@/pages/ai-tools/RAGAssistantPage";
import SuppliersPage from "@/pages/suppliers/SuppliersPage";
import ReportsPage from "@/pages/reports/ReportsPage";
import DocumentsPage from "@/pages/documents/DocumentsPage";
import NotificationsPage from "@/pages/notifications/NotificationsPage";
import SubscriptionsPage from "@/pages/subscriptions/SubscriptionsPage";
import DepartmentsPage from "@/pages/departments/DepartmentsPage";
import AuditLogsPage from "@/pages/audit-logs/AuditLogsPage";
import SecuritySettingsPage from "@/pages/security/SecuritySettingsPage";
import PatientPortalPage from "@/pages/portal/PatientPortalPage";
import InventoryPage from "@/pages/inventory/InventoryPage";
import BrandingSettingsPage from "@/pages/settings/BrandingSettingsPage";
import MonitoringPage from "@/pages/monitoring/MonitoringPage";
import OnboardingPage from "@/pages/admin/OnboardingPage";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/routes/ProtectedRoute";
import RequirePermission from "@/components/auth/RequirePermission";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/patients" element={<RequirePermission resource="patients"><PatientsPage /></RequirePermission>} />
        <Route path="/appointments" element={<RequirePermission resource="appointments"><AppointmentsPage /></RequirePermission>} />
        <Route path="/pharmacy" element={<RequirePermission resource="pharmacy"><PharmacyPage /></RequirePermission>} />
        <Route path="/billing" element={<RequirePermission resource="billing"><BillingPage /></RequirePermission>} />
        <Route path="/laboratory" element={<RequirePermission resource="laboratory"><LaboratoryPage /></RequirePermission>} />
        <Route path="/beds" element={<RequirePermission resource="beds"><BedsPage /></RequirePermission>} />
        <Route path="/staff" element={<RequirePermission resource="staff"><StaffPage /></RequirePermission>} />
        <Route path="/assets" element={<RequirePermission resource="assets"><AssetsPage /></RequirePermission>} />
        <Route path="/ai-tools" element={<RequirePermission resource="ai_copilot"><AiToolsPage /></RequirePermission>} />
        <Route path="/predictions" element={<PredictionsPage />} />
        <Route path="/document-ocr" element={<RequirePermission resource="ai_ocr"><DocumentOCRPage /></RequirePermission>} />
        <Route path="/ai-rag" element={<RequirePermission resource="ai_rag"><RAGAssistantPage /></RequirePermission>} />
        <Route path="/suppliers" element={<RequirePermission resource="inventory"><SuppliersPage /></RequirePermission>} />
        <Route path="/reports" element={<RequirePermission resource="reports"><ReportsPage /></RequirePermission>} />
        <Route path="/documents" element={<RequirePermission resource="documents"><DocumentsPage /></RequirePermission>} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/subscriptions" element={<SubscriptionsPage />} />
        <Route path="/departments" element={<RequirePermission resource="departments"><DepartmentsPage /></RequirePermission>} />
        <Route path="/audit-logs" element={<RequirePermission resource="audit_logs"><AuditLogsPage /></RequirePermission>} />
        <Route path="/security" element={<SecuritySettingsPage />} />
        <Route path="/portal" element={<PatientPortalPage />} />
        <Route path="/inventory" element={<RequirePermission resource="inventory"><InventoryPage /></RequirePermission>} />
        <Route path="/settings/branding" element={<BrandingSettingsPage />} />
                <Route path="/monitoring" element={<MonitoringPage />} />
        <Route path="/admin/onboarding" element={<OnboardingPage />} />
        <Route path="/admin/doctors" element={<RequirePermission resource="practitioners"><DoctorsPage /></RequirePermission>} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}