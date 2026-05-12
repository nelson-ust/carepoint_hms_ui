import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { AuthLayout } from "@/app/layouts/AuthLayout";
import { DashboardLayout } from "@/app/layouts/DashboardLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { routes } from "@/config/routes";
import { RefreshCw } from "lucide-react";

// --- Lazy Load Pages ---
const LandingPage = lazy(() => import("@/features/landing/pages/LandingPage").then(m => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import("@/features/auth/pages/LoginPage").then(m => ({ default: m.LoginPage })));
const SaasLoginPage = lazy(() => import("@/features/auth/pages/SaasLoginPage").then(m => ({ default: m.SaasLoginPage })));
const TenantRegisterPage = lazy(() => import("@/features/tenants/pages/TenantRegisterPage").then(m => ({ default: m.TenantRegisterPage })));
const TwoFactorPage = lazy(() => import("@/features/auth/pages/TwoFactorPage").then(m => ({ default: m.TwoFactorPage })));
const ForgotPasswordPage = lazy(() => import("@/features/auth/pages/ForgotPasswordPage").then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("@/features/auth/pages/ResetPasswordPage").then(m => ({ default: m.ResetPasswordPage })));

const TenantOverviewPage = lazy(() => import("@/features/tenant-dashboard/pages/TenantOverviewPage").then(m => ({ default: m.TenantOverviewPage })));
const PatientListingPage = lazy(() => import("@/features/patients/pages/PatientListingPage").then(m => ({ default: m.PatientListingPage })));
const PatientRegistrationPage = lazy(() => import("@/features/patients/pages/PatientRegistrationPage").then(m => ({ default: m.PatientRegistrationPage })));
const VisitListPage = lazy(() => import("@/features/visits/pages/VisitListPage").then(m => ({ default: m.VisitListPage })));
const VisitInitiationPage = lazy(() => import("@/features/visits/pages/VisitInitiationPage").then(m => ({ default: m.VisitInitiationPage })));
const VisitFlowManagementPage = lazy(() => import("@/features/visits/pages/VisitFlowManagementPage").then(m => ({ default: m.VisitFlowManagementPage })));
const VisitDetailPage = lazy(() => import("@/features/visits/pages/VisitDetailPage").then(m => ({ default: m.VisitDetailPage })));
const VisitReRoutePage = lazy(() => import("@/features/visits/pages/VisitReRoutePage").then(m => ({ default: m.VisitReRoutePage })));
const QueueDashboardPage = lazy(() => import("@/features/queues/pages/QueueDashboardPage").then(m => ({ default: m.QueueDashboardPage })));
const LabTestsPage = lazy(() => import("@/features/laboratory/pages/LabTestsPage").then(m => ({ default: m.LabTestsPage })));
const LabOrdersPage = lazy(() => import("@/features/laboratory/pages/LabOrdersPage").then(m => ({ default: m.LabOrdersPage })));
const LabResultsPage = lazy(() => import("@/features/laboratory/pages/LabResultsPage").then(m => ({ default: m.LabResultsPage })));
const DrugsPage = lazy(() => import("@/features/drugs/pages/DrugsPage").then(m => ({ default: m.DrugsPage })));
const StoresPage = lazy(() => import("@/features/inventory/pages/StoresPage").then(m => ({ default: m.StoresPage })));
const StockItemsPage = lazy(() => import("@/features/inventory/pages/StockItemsPage").then(m => ({ default: m.StockItemsPage })));
const StockItemDetailPage = lazy(() => import("@/features/inventory/pages/StockItemDetailPage").then(m => ({ default: m.StockItemDetailPage })));
const StockMovementsPage = lazy(() => import("@/features/inventory/pages/StockMovementsPage").then(m => ({ default: m.StockMovementsPage })));
const PharmacyQueuePage = lazy(() => import("@/features/pharmacy/pages/PharmacyQueuePage").then(m => ({ default: m.PharmacyQueuePage })));
const AdmissionsPage = lazy(() => import("@/features/admissions/pages/AdmissionsPage").then(m => ({ default: m.AdmissionsPage })));
const WardsBedsPage = lazy(() => import("@/features/admissions/pages/WardsBedsPage").then(m => ({ default: m.WardsBedsPage })));
const BedsPage = lazy(() => import("@/features/admissions/pages/BedsPage").then(m => ({ default: m.BedsPage })));

const AmbulanceListingPage = lazy(() => import("@/features/ambulance/pages/AmbulanceListingPage").then(m => ({ default: m.AmbulanceListingPage })));
const AmbulanceDetailPage = lazy(() => import("@/features/ambulance/pages/AmbulanceDetailPage").then(m => ({ default: m.AmbulanceDetailPage })));
const InvitationsPage = lazy(() => import("@/features/invitations/pages/InvitationsPage").then(m => ({ default: m.InvitationsPage })));
const SaaSInvoicesPage = lazy(() => import("@/features/billing/pages/SaaSInvoicesPage").then(m => ({ default: m.SaaSInvoicesPage })));
const SupportAccessPage = lazy(() => import("@/features/saas-dashboard/pages/SupportAccessPage").then(m => ({ default: m.SupportAccessPage })));
const ConnectivityPage = lazy(() => import("@/features/saas-dashboard/pages/ConnectivityPage").then(m => ({ default: m.ConnectivityPage })));
const DomainsPage = lazy(() => import("@/features/tenant-domains/pages/DomainsPage").then(m => ({ default: m.DomainsPage })));
const TenantListPage = lazy(() => import("@/features/tenants/pages/TenantListPage").then(m => ({ default: m.TenantListPage })));
const TenantDetailPage = lazy(() => import("@/features/tenants/pages/TenantDetailPage").then(m => ({ default: m.TenantDetailPage })));
const TenantModulesPage = lazy(() => import("@/features/tenant-modules/pages/TenantModulesPage").then(m => ({ default: m.TenantModulesPage })));
const SDPListingPage = lazy(() => import("@/features/service-delivery-points/pages/SDPListingPage").then(m => ({ default: m.SDPListingPage })));
const AdherenceDashboardPage = lazy(() => import("@/features/medication-adherence/pages/AdherenceDashboardPage").then(m => ({ default: m.AdherenceDashboardPage })));
const LoyaltyPage = lazy(() => import("@/features/patients/pages/LoyaltyPage").then(m => ({ default: m.LoyaltyPage })));
const PaymentGatewaysPage = lazy(() => import("@/features/billing/pages/PaymentGatewaysPage").then(m => ({ default: m.PaymentGatewaysPage })));
const BillingListPage = lazy(() => import("@/features/billing/pages/BillingListPage").then(m => ({ default: m.BillingListPage })));
const BillingDetailPage = lazy(() => import("@/features/billing/pages/BillingDetailPage").then(m => ({ default: m.BillingDetailPage })));
const DoctorCalendarPage = lazy(() => import("@/features/doctor-calendar/pages/DoctorCalendarPage").then(m => ({ default: m.DoctorCalendarPage })));
const TriagePage = lazy(() => import("@/features/clinical/pages/TriagePage").then(m => ({ default: m.TriagePage })));
const ConsultationPage = lazy(() => import("@/features/clinical/pages/ConsultationPage").then(m => ({ default: m.ConsultationPage })));
const StaffManagementPage = lazy(() => import("@/features/staff/pages/StaffManagementPage").then(m => ({ default: m.StaffManagementPage })));
const EmailSettingsPage = lazy(() => import("@/features/settings/pages/EmailSettingsPage").then(m => ({ default: m.EmailSettingsPage })));
const TenantJobsPage = lazy(() => import("@/features/settings/pages/TenantJobsPage").then(m => ({ default: m.TenantJobsPage })));
const SettingsPage = lazy(() => import("@/features/settings/pages/SettingsPage").then(m => ({ default: m.SettingsPage })));
const InsuranceClaimsPage = lazy(() => import("@/features/insurance/pages/InsuranceClaimsPage").then(m => ({ default: m.InsuranceClaimsPage })));
const HRDashboardPage = lazy(() => import("@/features/staff/pages/HRDashboardPage").then(m => ({ default: m.HRDashboardPage })));
const RadiologyOrdersPage = lazy(() => import("@/features/radiology/pages/RadiologyOrdersPage").then(m => ({ default: m.RadiologyOrdersPage })));
const ApprovalsListPage = lazy(() => import("@/features/approvals/pages/ApprovalsListPage").then(m => ({ default: m.ApprovalsListPage })));
const ReportsDashboardPage = lazy(() => import("@/features/reports/pages/ReportsDashboardPage").then(m => ({ default: m.ReportsDashboardPage })));
const AppointmentsRegistryPage = lazy(() => import("@/features/appointments/pages/AppointmentsRegistryPage").then(m => ({ default: m.AppointmentsRegistryPage })));
const LeaveRequestsPage = lazy(() => import("@/features/hr/pages/LeaveRequestsPage").then(m => ({ default: m.LeaveRequestsPage })));
const TaxDashboardPage = lazy(() => import("@/features/tax/pages/TaxDashboardPage").then(m => ({ default: m.TaxDashboardPage })));
const ComplianceRecordsPage = lazy(() => import("@/features/compliance/pages/ComplianceRecordsPage").then(m => ({ default: m.ComplianceRecordsPage })));
const DatabaseBackupsPage = lazy(() => import("@/features/backups/pages/DatabaseBackupsPage").then(m => ({ default: m.DatabaseBackupsPage })));
const TimesheetsPage = lazy(() => import("@/features/staff/pages/TimesheetsPage").then(m => ({ default: m.TimesheetsPage })));
const StaffFinancePage = lazy(() => import("@/features/staff/pages/StaffFinancePage").then(m => ({ default: m.StaffFinancePage })));
const ProcurementPage = lazy(() => import("@/features/inventory/pages/ProcurementPage").then(m => ({ default: m.ProcurementPage })));
const MembershipCardsPage = lazy(() => import("@/features/patients/pages/MembershipCardsPage").then(m => ({ default: m.MembershipCardsPage })));
const ClinicalTemplatesPage = lazy(() => import("@/features/clinical/pages/ClinicalTemplatesPage").then(m => ({ default: m.ClinicalTemplatesPage })));

// --- Loader Component ---
function PageLoader() {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-secondary-50/30 backdrop-blur-sm">
      <div className="relative">
        <div className="h-16 w-16 border-4 border-secondary-100 rounded-full" />
        <div className="absolute inset-0 h-16 w-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
      <p className="mt-6 text-xs font-bold text-secondary-400 uppercase tracking-[0.3em] animate-pulse">Initializing Interface</p>
    </div>
  );
}

const router = createBrowserRouter([
  { path: routes.home, element: <Suspense fallback={<PageLoader />}><LandingPage /></Suspense> },
  { path: routes.tenantRegister, element: <Suspense fallback={<PageLoader />}><TenantRegisterPage /></Suspense> },
  { path: routes.saasLogin, element: <Suspense fallback={<PageLoader />}><SaasLoginPage /></Suspense> },

  {
    path: routes.login,
    element: <AuthLayout />,
    children: [{ index: true, element: <Suspense fallback={<PageLoader />}><LoginPage /></Suspense> }],
  },

  { path: routes.twoFactor, element: <Suspense fallback={<PageLoader />}><TwoFactorPage /></Suspense> },
  { path: routes.forgotPassword, element: <Suspense fallback={<PageLoader />}><ForgotPasswordPage /></Suspense> },
  { path: routes.resetPassword, element: <Suspense fallback={<PageLoader />}><ResetPasswordPage /></Suspense> },

  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { path: routes.dashboard, element: <Suspense fallback={<PageLoader />}><TenantOverviewPage /></Suspense> },

          // Patient Flow
          { path: routes.patients, element: <Suspense fallback={<PageLoader />}><PatientListingPage /></Suspense> },
          { path: routes.loyalty, element: <Suspense fallback={<PageLoader />}><LoyaltyPage /></Suspense> },
          { path: routes.membershipCards, element: <Suspense fallback={<PageLoader />}><MembershipCardsPage /></Suspense> },
          { path: routes.patientRegister, element: <Suspense fallback={<PageLoader />}><PatientRegistrationPage /></Suspense> },

          // Visit Flow
          { path: routes.visits, element: <Suspense fallback={<PageLoader />}><VisitListPage /></Suspense> },
          { path: routes.visitInitiate, element: <Suspense fallback={<PageLoader />}><VisitInitiationPage /></Suspense> },
          { path: routes.visitFlows, element: <Suspense fallback={<PageLoader />}><VisitFlowManagementPage /></Suspense> },
          { path: routes.visitDetail, element: <Suspense fallback={<PageLoader />}><VisitDetailPage /></Suspense> },
          { path: routes.visitReroute, element: <Suspense fallback={<PageLoader />}><VisitReRoutePage /></Suspense> },

          // Service Delivery Points
          { path: routes.serviceDeliveryPoints, element: <Suspense fallback={<PageLoader />}><SDPListingPage /></Suspense> },

          // Queue Management
          { path: routes.queues, element: <Suspense fallback={<PageLoader />}><QueueDashboardPage /></Suspense> },

          // Laboratory
          { path: routes.laboratory, element: <Navigate to={routes.labOrders} replace /> },
          { path: routes.labTests, element: <Suspense fallback={<PageLoader />}><LabTestsPage /></Suspense> },
          { path: routes.labOrders, element: <Suspense fallback={<PageLoader />}><LabOrdersPage /></Suspense> },
          { path: routes.labResults, element: <Suspense fallback={<PageLoader />}><LabResultsPage /></Suspense> },

          // Drugs Catalogue
          { path: routes.drugs, element: <Suspense fallback={<PageLoader />}><DrugsPage /></Suspense> },

          // Inventory
          { path: routes.inventory, element: <Navigate to={routes.inventoryStores} replace /> },
          { path: routes.inventoryStores, element: <Suspense fallback={<PageLoader />}><StoresPage /></Suspense> },
          { path: routes.inventoryItems, element: <Suspense fallback={<PageLoader />}><StockItemsPage /></Suspense> },
          { path: routes.inventoryItemDetail, element: <Suspense fallback={<PageLoader />}><StockItemDetailPage /></Suspense> },
          { path: routes.inventoryMovements, element: <Suspense fallback={<PageLoader />}><StockMovementsPage /></Suspense> },
          { path: routes.procurement, element: <Suspense fallback={<PageLoader />}><ProcurementPage /></Suspense> },

          // Financial Flow
          { path: routes.billing, element: <Suspense fallback={<PageLoader />}><BillingListPage /></Suspense> },
          { path: routes.billingDetail, element: <Suspense fallback={<PageLoader />}><BillingDetailPage /></Suspense> },
          { path: routes.patientPaymentGateways, element: <Suspense fallback={<PageLoader />}><PaymentGatewaysPage /></Suspense> },
          { path: routes.payments, element: <Navigate to={routes.billing} replace /> },
          { path: routes.insurance, element: <Suspense fallback={<PageLoader />}><InsuranceClaimsPage /></Suspense> },

          // Pharmacy
          { path: routes.pharmacy, element: <Suspense fallback={<PageLoader />}><PharmacyQueuePage /></Suspense> },
          { path: routes.pharmacyDispense, element: <Navigate to={routes.pharmacy} replace /> },
          { path: routes.radiology, element: <Suspense fallback={<PageLoader />}><RadiologyOrdersPage /></Suspense> },

          // Admissions
          { path: routes.admissions, element: <Suspense fallback={<PageLoader />}><AdmissionsPage /></Suspense> },
          { path: routes.wards, element: <Suspense fallback={<PageLoader />}><WardsBedsPage /></Suspense> },
          { path: routes.beds, element: <Suspense fallback={<PageLoader />}><BedsPage /></Suspense> },

          // Ambulance
          { path: routes.ambulances, element: <Suspense fallback={<PageLoader />}><AmbulanceListingPage /></Suspense> },
          { path: routes.ambulanceDetail, element: <Suspense fallback={<PageLoader />}><AmbulanceDetailPage /></Suspense> },

          // Invitations
          { path: routes.invitations, element: <Suspense fallback={<PageLoader />}><InvitationsPage /></Suspense> },

          // SaaS Billing
          { path: routes.saasInvoices, element: <Suspense fallback={<PageLoader />}><SaaSInvoicesPage /></Suspense> },

          // Support Access
          { path: routes.supportAccess, element: <Suspense fallback={<PageLoader />}><SupportAccessPage /></Suspense> },
          { path: routes.connectivity, element: <Suspense fallback={<PageLoader />}><ConnectivityPage /></Suspense> },

          // SaaS Tenant Management
          { path: routes.tenants, element: <Suspense fallback={<PageLoader />}><TenantListPage /></Suspense> },
          { path: routes.tenantDomains, element: <Suspense fallback={<PageLoader />}><DomainsPage /></Suspense> },
          { path: routes.tenantDetail, element: <Suspense fallback={<PageLoader />}><TenantDetailPage /></Suspense> },
          { path: routes.tenantModules, element: <Suspense fallback={<PageLoader />}><TenantModulesPage /></Suspense> },

          // Clinical Flow
          { path: routes.clinical, element: <Navigate to={routes.dashboard} replace /> },
          { path: routes.medicationAdherence, element: <Suspense fallback={<PageLoader />}><AdherenceDashboardPage /></Suspense> },
          { path: routes.clinicalTemplates, element: <Suspense fallback={<PageLoader />}><ClinicalTemplatesPage /></Suspense> },
          { path: `${routes.triage}/:visitId`, element: <Suspense fallback={<PageLoader />}><TriagePage /></Suspense> },
          { path: `${routes.consultation}/:visitId`, element: <Suspense fallback={<PageLoader />}><ConsultationPage /></Suspense> },

          // Administrative
          { path: routes.staff, element: <Suspense fallback={<PageLoader />}><StaffManagementPage /></Suspense> },
          { path: routes.settings, element: <Suspense fallback={<PageLoader />}><SettingsPage /></Suspense> },
          { path: routes.hr, element: <Suspense fallback={<PageLoader />}><HRDashboardPage /></Suspense> },
          { path: routes.payroll, element: <Suspense fallback={<PageLoader />}><HRDashboardPage /></Suspense> },
          { path: routes.emailSettings, element: <Suspense fallback={<PageLoader />}><EmailSettingsPage /></Suspense> },
          { path: routes.tenantJobs, element: <Suspense fallback={<PageLoader />}><TenantJobsPage /></Suspense> },
          { path: routes.approvals, element: <Suspense fallback={<PageLoader />}><ApprovalsListPage /></Suspense> },
          { path: routes.reports, element: <Suspense fallback={<PageLoader />}><ReportsDashboardPage /></Suspense> },
          { path: routes.appointments, element: <Suspense fallback={<PageLoader />}><AppointmentsRegistryPage /></Suspense> },
          { path: routes.leaveRequests, element: <Suspense fallback={<PageLoader />}><LeaveRequestsPage /></Suspense> },
          { path: routes.tax, element: <Suspense fallback={<PageLoader />}><TaxDashboardPage /></Suspense> },
          { path: routes.compliance, element: <Suspense fallback={<PageLoader />}><ComplianceRecordsPage /></Suspense> },
          { path: routes.backups, element: <Suspense fallback={<PageLoader />}><DatabaseBackupsPage /></Suspense> },
          { path: routes.timesheets, element: <Suspense fallback={<PageLoader />}><TimesheetsPage /></Suspense> },
          { path: routes.staffFinance, element: <Suspense fallback={<PageLoader />}><StaffFinancePage /></Suspense> },
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
