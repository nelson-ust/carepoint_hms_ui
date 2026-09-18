import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { AuthLayout } from "@/app/layouts/AuthLayout";
import { DashboardLayout } from "@/app/layouts/DashboardLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { routes } from "@/config/routes";
import { RouteErrorBoundary } from "@/components/common/ErrorBoundary";
import { PatientDetailPage } from "@/features/patients/pages/PatientDetailPage";

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
const LabResultTrackerPage = lazy(() => import("@/features/laboratory/pages/LabResultTrackerPage").then(m => ({ default: m.LabResultTrackerPage })));
const DrugsPage = lazy(() => import("@/features/drugs/pages/DrugsPage").then(m => ({ default: m.DrugsPage })));
const StoresPage = lazy(() => import("@/features/inventory/pages/StoresPage").then(m => ({ default: m.StoresPage })));
const StockItemsPage = lazy(() => import("@/features/inventory/pages/StockItemsPage").then(m => ({ default: m.StockItemsPage })));
const StockItemDetailPage = lazy(() => import("@/features/inventory/pages/StockItemDetailPage").then(m => ({ default: m.StockItemDetailPage })));
const StockMovementsPage = lazy(() => import("@/features/inventory/pages/StockMovementsPage").then(m => ({ default: m.StockMovementsPage })));
const PharmacyQueuePage = lazy(() => import("@/features/pharmacy/pages/PharmacyQueuePage").then(m => ({ default: m.PharmacyQueuePage })));
const AdmissionsPage = lazy(() => import("@/features/admissions/pages/AdmissionsPage").then(m => ({ default: m.AdmissionsPage })));
const WardsBedsPage = lazy(() => import("@/features/admissions/pages/WardsBedsPage").then(m => ({ default: m.WardsBedsPage })));
const BedsPage = lazy(() => import("@/features/admissions/pages/BedsPage").then(m => ({ default: m.BedsPage })));
const SurgeryWorklistPage = lazy(() => import("@/features/surgery/pages/SurgeryWorklistPage").then(m => ({ default: m.SurgeryWorklistPage })));
const SurgicalCaseDetailPage = lazy(() => import("@/features/surgery/pages/SurgicalCaseDetailPage").then(m => ({ default: m.SurgicalCaseDetailPage })));
const TheatresPage = lazy(() => import("@/features/surgery/pages/TheatresPage").then(m => ({ default: m.TheatresPage })));
const ProcedureCatalogPage = lazy(() => import("@/features/surgery/pages/ProcedureCatalogPage").then(m => ({ default: m.ProcedureCatalogPage })));
const InstrumentSetsPage = lazy(() => import("@/features/surgery/pages/InstrumentSetsPage").then(m => ({ default: m.InstrumentSetsPage })));

const AmbulanceListingPage = lazy(() => import("@/features/ambulance/pages/AmbulanceListingPage").then(m => ({ default: m.AmbulanceListingPage })));
const AmbulanceDetailPage = lazy(() => import("@/features/ambulance/pages/AmbulanceDetailPage").then(m => ({ default: m.AmbulanceDetailPage })));
const InvitationsPage = lazy(() => import("@/features/invitations/pages/InvitationsPage").then(m => ({ default: m.InvitationsPage })));
const SaaSInvoicesPage = lazy(() => import("@/features/billing/pages/SaaSInvoicesPage").then(m => ({ default: m.SaaSInvoicesPage })));
const SubscriptionPlansPage = lazy(() => import("@/features/saas-dashboard/pages/SubscriptionPlansPage").then(m => ({ default: m.SubscriptionPlansPage })));
const SupportAccessPage = lazy(() => import("@/features/saas-dashboard/pages/SupportAccessPage").then(m => ({ default: m.SupportAccessPage })));
const ConnectivityPage = lazy(() => import("@/features/saas-dashboard/pages/ConnectivityPage").then(m => ({ default: m.ConnectivityPage })));
const SaasOverviewPage = lazy(() => import("@/features/saas-dashboard/pages/SaasOverviewPage").then(m => ({ default: m.SaasOverviewPage })));
const DomainsPage = lazy(() => import("@/features/tenant-domains/pages/DomainsPage").then(m => ({ default: m.DomainsPage })));
const TenantListPage = lazy(() => import("@/features/tenants/pages/TenantListPage").then(m => ({ default: m.TenantListPage })));
const TenantDetailPage = lazy(() => import("@/features/tenants/pages/TenantDetailPage").then(m => ({ default: m.TenantDetailPage })));
const TenantModulesPage = lazy(() => import("@/features/tenant-modules/pages/TenantModulesPage").then(m => ({ default: m.TenantModulesPage })));
const SDPListingPage = lazy(() => import("@/features/service-delivery-points/pages/SDPListingPage").then(m => ({ default: m.SDPListingPage })));
const InteroperabilityPage = lazy(() => import("@/features/interoperability/pages/InteroperabilityPage").then(m => ({ default: m.InteroperabilityPage })));
const IntegrationsPage = lazy(() => import("@/features/integrations/pages/IntegrationsPage").then(m => ({ default: m.IntegrationsPage })));
const DeveloperPortalPage = lazy(() => import("@/features/developer-portal/pages/DeveloperPortalPage").then(m => ({ default: m.DeveloperPortalPage })));
const DeveloperAccessPage = lazy(() => import("@/features/developer-portal/pages/DeveloperAccessPage").then(m => ({ default: m.DeveloperAccessPage })));
const MedicalAccessConsolePage = lazy(() => import("@/features/medical-access/pages/MedicalAccessConsolePage").then(m => ({ default: m.MedicalAccessConsolePage })));
const PatientDecisionPage = lazy(() => import("@/features/medical-access/pages/PatientDecisionPage").then(m => ({ default: m.PatientDecisionPage })));
const AccessLinkViewerPage = lazy(() => import("@/features/medical-access/pages/AccessLinkViewerPage").then(m => ({ default: m.AccessLinkViewerPage })));
const PublicCardVerifyPage = lazy(() => import("@/features/patients/pages/PublicCardVerifyPage").then(m => ({ default: m.PublicCardVerifyPage })));
const JournalEntriesPage = lazy(() => import("@/features/accounting/pages/JournalEntriesPage").then(m => ({ default: m.JournalEntriesPage })));
const GeneralLedgerPage = lazy(() => import("@/features/accounting/pages/GeneralLedgerPage").then(m => ({ default: m.GeneralLedgerPage })));
const FinancialReportsPage = lazy(() => import("@/features/accounting/pages/FinancialReportsPage").then(m => ({ default: m.FinancialReportsPage })));
const PayablesPage = lazy(() => import("@/features/accounting/pages/PayablesPage").then(m => ({ default: m.PayablesPage })));
const FixedAssetsPage = lazy(() => import("@/features/accounting/pages/FixedAssetsPage").then(m => ({ default: m.FixedAssetsPage })));
const BudgetsPage = lazy(() => import("@/features/accounting/pages/BudgetsPage").then(m => ({ default: m.BudgetsPage })));
const FacilitiesPage = lazy(() => import("@/features/facilities/pages/FacilitiesPage").then(m => ({ default: m.FacilitiesPage })));
const AdherenceDashboardPage = lazy(() => import("@/features/medication-adherence/pages/AdherenceDashboardPage").then(m => ({ default: m.AdherenceDashboardPage })));
const LoyaltyPage = lazy(() => import("@/features/patients/pages/LoyaltyPage").then(m => ({ default: m.LoyaltyPage })));
const PaymentGatewaysPage = lazy(() => import("@/features/billing/pages/PaymentGatewaysPage").then(m => ({ default: m.PaymentGatewaysPage })));
const BillingListPage = lazy(() => import("@/features/billing/pages/BillingListPage").then(m => ({ default: m.BillingListPage })));
const BillableServicesPage = lazy(() => import("@/features/billing/pages/BillableServicesPage").then(m => ({ default: m.BillableServicesPage })));
const ChartOfAccountsPage = lazy(() => import("@/features/billing/pages/ChartOfAccountsPage").then(m => ({ default: m.ChartOfAccountsPage })));
const BillingDetailPage = lazy(() => import("@/features/billing/pages/BillingDetailPage").then(m => ({ default: m.BillingDetailPage })));
const DoctorCalendarPage = lazy(() => import("@/features/doctor-calendar/pages/DoctorCalendarPage").then(m => ({ default: m.DoctorCalendarPage })));
const TriagePage = lazy(() => import("@/features/clinical/pages/TriagePage").then(m => ({ default: m.TriagePage })));
const ConsultationPage = lazy(() => import("@/features/clinical/pages/ConsultationPage").then(m => ({ default: m.ConsultationPage })));
const StaffManagementPage = lazy(() => import("@/features/staff/pages/StaffManagementPage").then(m => ({ default: m.StaffManagementPage })));
const EmailSettingsPage = lazy(() => import("@/features/settings/pages/EmailSettingsPage").then(m => ({ default: m.EmailSettingsPage })));
const TenantJobsPage = lazy(() => import("@/features/settings/pages/TenantJobsPage").then(m => ({ default: m.TenantJobsPage })));
const BrandingPage = lazy(() => import("@/features/settings/pages/BrandingPage").then(m => ({ default: m.BrandingPage })));
const SettingsPage = lazy(() => import("@/features/settings/pages/SettingsPage").then(m => ({ default: m.SettingsPage })));
const InsuranceClaimsPage = lazy(() => import("@/features/insurance/pages/InsuranceClaimsPage").then(m => ({ default: m.InsuranceClaimsPage })));
const InsuranceDashboardPage = lazy(() => import("@/features/insurance/pages/InsuranceDashboardPage").then(m => ({ default: m.InsuranceDashboardPage })));
const PayersPage = lazy(() => import("@/features/insurance/pages/PayersPage").then(m => ({ default: m.PayersPage })));
const EnrolleesPage = lazy(() => import("@/features/insurance/pages/EnrolleesPage").then(m => ({ default: m.EnrolleesPage })));
const RemittancesPage = lazy(() => import("@/features/insurance/pages/RemittancesPage").then(m => ({ default: m.RemittancesPage })));
const BankingPage = lazy(() => import("@/features/accounting/pages/BankingPage").then(m => ({ default: m.BankingPage })));
const CashOfficePage = lazy(() => import("@/features/accounting/pages/CashOfficePage").then(m => ({ default: m.CashOfficePage })));
const ArDocumentsPage = lazy(() => import("@/features/accounting/pages/ArDocumentsPage").then(m => ({ default: m.ArDocumentsPage })));
const FinanceReportsExtPage = lazy(() => import("@/features/accounting/pages/FinanceReportsExtPage").then(m => ({ default: m.FinanceReportsExtPage })));
const FinanceSettingsPage = lazy(() => import("@/features/accounting/pages/FinanceSettingsPage").then(m => ({ default: m.FinanceSettingsPage })));
const StatutoryPage = lazy(() => import("@/features/accounting/pages/StatutoryPage").then(m => ({ default: m.StatutoryPage })));
const HRDashboardPage = lazy(() => import("@/features/staff/pages/HRDashboardPage").then(m => ({ default: m.HRDashboardPage })));
const RadiologyOrdersPage = lazy(() => import("@/features/radiology/pages/RadiologyOrdersPage").then(m => ({ default: m.RadiologyOrdersPage })));
const ApprovalsListPage = lazy(() => import("@/features/approvals/pages/ApprovalsListPage").then(m => ({ default: m.ApprovalsListPage })));
const ApprovalFlowsPage = lazy(() => import("@/features/approvals/pages/ApprovalFlowsPage").then(m => ({ default: m.ApprovalFlowsPage })));
const ApprovalRequestPage = lazy(() => import("@/features/approvals/pages/ApprovalRequestPage").then(m => ({ default: m.ApprovalRequestPage })));
const ReportsDashboardPage = lazy(() => import("@/features/reports/pages/ReportsDashboardPage").then(m => ({ default: m.ReportsDashboardPage })));
const AppointmentsRegistryPage = lazy(() => import("@/features/appointments/pages/AppointmentsRegistryPage").then(m => ({ default: m.AppointmentsRegistryPage })));
const HomeVisitsPage = lazy(() => import("@/features/home-health/pages/HomeVisitsPage").then(m => ({ default: m.HomeVisitsPage })));
const HomeVisitDetailPage = lazy(() => import("@/features/home-health/pages/HomeVisitDetailPage").then(m => ({ default: m.HomeVisitDetailPage })));
const CarePlansPage = lazy(() => import("@/features/home-health/pages/CarePlansPage").then(m => ({ default: m.CarePlansPage })));
const CarePlanDetailPage = lazy(() => import("@/features/home-health/pages/CarePlanDetailPage").then(m => ({ default: m.CarePlanDetailPage })));
const RemoteMonitoringPage = lazy(() => import("@/features/home-health/pages/RemoteMonitoringPage").then(m => ({ default: m.RemoteMonitoringPage })));
const ClinicalAlertsPage = lazy(() => import("@/features/home-health/pages/ClinicalAlertsPage").then(m => ({ default: m.ClinicalAlertsPage })));
const TelemedicineSessionsPage = lazy(() => import("@/features/telemedicine/pages/TelemedicineSessionsPage").then(m => ({ default: m.TelemedicineSessionsPage })));
const TelemedicineConsolePage = lazy(() => import("@/features/telemedicine/pages/TelemedicineConsolePage").then(m => ({ default: m.TelemedicineConsolePage })));
const LeaveRequestsPage = lazy(() => import("@/features/hr/pages/LeaveRequestsPage").then(m => ({ default: m.LeaveRequestsPage })));
const MyLeavePage = lazy(() => import("@/features/hr/pages/MyLeavePage").then(m => ({ default: m.MyLeavePage })));
const TaxDashboardPage = lazy(() => import("@/features/tax/pages/TaxDashboardPage").then(m => ({ default: m.TaxDashboardPage })));
const ComplianceRecordsPage = lazy(() => import("@/features/compliance/pages/ComplianceRecordsPage").then(m => ({ default: m.ComplianceRecordsPage })));
const DatabaseBackupsPage = lazy(() => import("@/features/backups/pages/DatabaseBackupsPage").then(m => ({ default: m.DatabaseBackupsPage })));
const TimesheetsPage = lazy(() => import("@/features/staff/pages/TimesheetsPage").then(m => ({ default: m.TimesheetsPage })));
const StaffFinancePage = lazy(() => import("@/features/staff/pages/StaffFinancePage").then(m => ({ default: m.StaffFinancePage })));
const ProcurementPage = lazy(() => import("@/features/inventory/pages/ProcurementPage").then(m => ({ default: m.ProcurementPage })));
const MembershipCardsPage = lazy(() => import("@/features/patients/pages/MembershipCardsPage").then(m => ({ default: m.MembershipCardsPage })));
const CardFundingApprovalsPage = lazy(() => import("@/features/patients/pages/CardFundingApprovalsPage").then(m => ({ default: m.CardFundingApprovalsPage })));
const ClinicalTemplatesPage = lazy(() => import("@/features/clinical/pages/ClinicalTemplatesPage").then(m => ({ default: m.ClinicalTemplatesPage })));
const PaymentsPage = lazy(() => import("@/features/payments/pages/PaymentsPage").then(m => ({ default: m.PaymentsPage })));
const NotificationsPage = lazy(() => import("@/features/notifications/pages/NotificationsPage").then(m => ({ default: m.NotificationsPage })));
const RolesPage = lazy(() => import("@/features/roles/pages/RolesPage").then(m => ({ default: m.RolesPage })));
const PatientMessagesPage = lazy(() => import("@/features/portal-messages/pages/PatientMessagesPage").then(m => ({ default: m.PatientMessagesPage })));
const SendMessagePage = lazy(() => import("@/features/patient-broadcasts/pages/SendMessagePage").then(m => ({ default: m.SendMessagePage })));
const ProfilePage = lazy(() => import("@/features/users/pages/ProfilePage").then(m => ({ default: m.ProfilePage })));
const PayrollRunsPage = lazy(() => import("@/features/payroll/pages/PayrollRunsPage").then(m => ({ default: m.PayrollRunsPage })));
const SalaryMappingPage = lazy(() => import("@/features/payroll/pages/SalaryMappingPage").then(m => ({ default: m.SalaryMappingPage })));
const PayrollLookupsPage = lazy(() => import("@/features/payroll/pages/PayrollLookupsPage").then(m => ({ default: m.PayrollLookupsPage })));
const PayrollComponentsPage = lazy(() => import("@/features/payroll/pages/PayrollComponentsPage").then(m => ({ default: m.PayrollComponentsPage })));
const PensionProvidersPage = lazy(() => import("@/features/payroll/pages/PensionProvidersPage").then(m => ({ default: m.PensionProvidersPage })));
const AttendancePage = lazy(() => import("@/features/hr/pages/AttendancePage").then(m => ({ default: m.AttendancePage })));
const StaffRecordsPage = lazy(() => import("@/features/hr/pages/StaffRecordsPage").then(m => ({ default: m.StaffRecordsPage })));
const RosterPage = lazy(() => import("@/features/hr/pages/RosterPage").then(m => ({ default: m.RosterPage })));
const AcceptInvitationPage = lazy(() => import("@/features/invitations/pages/AcceptInvitationPage").then(m => ({ default: m.AcceptInvitationPage })));
const PlanBillingPage = lazy(() => import("@/features/billing/pages/PlanBillingPage").then(m => ({ default: m.PlanBillingPage })));
const BillingCallbackPage = lazy(() => import("@/features/billing/pages/BillingCallbackPage").then(m => ({ default: m.BillingCallbackPage })));
const PaymentConfirmationsPage = lazy(() => import("@/features/billing/pages/PaymentConfirmationsPage").then(m => ({ default: m.PaymentConfirmationsPage })));
const PaymentsLookupPage = lazy(() => import("@/features/billing/pages/PaymentsLookupPage").then(m => ({ default: m.PaymentsLookupPage })));
const PortalLoginPage = lazy(() => import("@/features/patient-portal/pages/PortalLoginPage").then(m => ({ default: m.PortalLoginPage })));
const PortalDashboardPage = lazy(() => import("@/features/patient-portal/pages/PortalDashboardPage").then(m => ({ default: m.PortalDashboardPage })));
const PortalAppointmentsPage = lazy(() => import("@/features/patient-portal/pages/PortalAppointmentsPage").then(m => ({ default: m.PortalAppointmentsPage })));
const PortalProfilePage = lazy(() => import("@/features/patient-portal/pages/PortalProfilePage").then(m => ({ default: m.PortalProfilePage })));
const PortalHomeCarePage = lazy(() => import("@/features/patient-portal/pages/PortalHomeCarePage").then(m => ({ default: m.PortalHomeCarePage })));
const PortalTelehealthPage = lazy(() => import("@/features/patient-portal/pages/PortalTelehealthPage").then(m => ({ default: m.PortalTelehealthPage })));
const PortalNotificationsPage = lazy(() => import("@/features/patient-portal/pages/PortalNotificationsPage").then(m => ({ default: m.PortalNotificationsPage })));
const PortalLabResultsPage = lazy(() => import("@/features/patient-portal/pages/PortalLabResultsPage").then(m => ({ default: m.PortalLabResultsPage })));
const PortalInvoicesPage = lazy(() => import("@/features/patient-portal/pages/PortalInvoicesPage").then(m => ({ default: m.PortalInvoicesPage })));
const PortalBaselineDiagnosticsPage = lazy(() => import("@/features/patient-portal/pages/PortalBaselineDiagnosticsPage").then(m => ({ default: m.PortalBaselineDiagnosticsPage })));
const MedicalExamsPage = lazy(() => import("@/features/clinical/pages/MedicalExamsPage").then(m => ({ default: m.MedicalExamsPage })));
const PortalMessagesPage = lazy(() => import("@/features/patient-portal/pages/PortalMessagesPage").then(m => ({ default: m.PortalMessagesPage })));
const PortalLayout = lazy(() => import("@/features/patient-portal/components/PortalLayout").then(m => ({ default: m.PortalLayout })));
const ProtectedPortalRoute = lazy(() => import("@/features/patient-portal/ProtectedPortalRoute").then(m => ({ default: m.ProtectedPortalRoute })));
const QueueDisplayBoardPage = lazy(() => import("@/features/queues/pages/QueueDisplayBoardPage").then(m => ({ default: m.QueueDisplayBoardPage })));
const QueueAnalyticsPage = lazy(() => import("@/features/queues/pages/QueueAnalyticsPage").then(m => ({ default: m.QueueAnalyticsPage })));

// --- Loader Component ---
function PageLoader() {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-secondary-50/30 backdrop-blur-sm">
      <div className="relative">
        <div className="h-16 w-16 border-4 border-secondary-400 rounded-full" />
        <div className="absolute inset-0 h-16 w-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
      <p className="mt-6 text-xs font-bold text-secondary-400 uppercase tracking-[0.3em] animate-pulse">Initializing Interface</p>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: routes.home,
    element: <Suspense fallback={<PageLoader />}><LandingPage /></Suspense>,
    errorElement: <RouteErrorBoundary />
  },
  {
    path: routes.tenantRegister,
    element: <Suspense fallback={<PageLoader />}><TenantRegisterPage /></Suspense>,
    errorElement: <RouteErrorBoundary />
  },
  {
    path: routes.saasLogin,
    element: <Suspense fallback={<PageLoader />}><SaasLoginPage /></Suspense>,
    errorElement: <RouteErrorBoundary />
  },

  {
    path: routes.portalLogin,
    element: <Suspense fallback={<PageLoader />}><PortalLoginPage /></Suspense>,
    errorElement: <RouteErrorBoundary />
  },

  {
    path: routes.developerPortal,
    element: <Suspense fallback={<PageLoader />}><DeveloperPortalPage /></Suspense>,
    errorElement: <RouteErrorBoundary />
  },

  {
    path: `${routes.medicalAccessPatient}/:token`,
    element: <Suspense fallback={<PageLoader />}><PatientDecisionPage /></Suspense>,
    errorElement: <RouteErrorBoundary />
  },
  {
    path: `${routes.medicalAccessView}/:token`,
    element: <Suspense fallback={<PageLoader />}><AccessLinkViewerPage /></Suspense>,
    errorElement: <RouteErrorBoundary />
  },

  {
    path: routes.verifyCard,
    element: <Suspense fallback={<PageLoader />}><PublicCardVerifyPage /></Suspense>,
    errorElement: <RouteErrorBoundary />
  },

  {
    path: routes.invitationAccept,
    element: <Suspense fallback={<PageLoader />}><AcceptInvitationPage /></Suspense>,
    errorElement: <RouteErrorBoundary />
  },

  {
    path: routes.billingCallback,
    element: <Suspense fallback={<PageLoader />}><BillingCallbackPage /></Suspense>,
    errorElement: <RouteErrorBoundary />
  },
  {
    element: <Suspense fallback={<PageLoader />}><ProtectedPortalRoute /></Suspense>,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <Suspense fallback={<PageLoader />}><PortalLayout /></Suspense>,
        children: [
          { path: routes.portalHome, element: <Suspense fallback={<PageLoader />}><PortalDashboardPage /></Suspense> },
          { path: routes.portalAppointments, element: <Suspense fallback={<PageLoader />}><PortalAppointmentsPage /></Suspense> },
          { path: routes.portalNotifications, element: <Suspense fallback={<PageLoader />}><PortalNotificationsPage /></Suspense> },
          { path: routes.portalLabResults, element: <Suspense fallback={<PageLoader />}><PortalLabResultsPage /></Suspense> },
          { path: routes.portalInvoices, element: <Suspense fallback={<PageLoader />}><PortalInvoicesPage /></Suspense> },
          { path: routes.portalBaselineDiagnostics, element: <Suspense fallback={<PageLoader />}><PortalBaselineDiagnosticsPage /></Suspense> },
          { path: routes.portalMessages, element: <Suspense fallback={<PageLoader />}><PortalMessagesPage /></Suspense> },
          { path: routes.portalProfile, element: <Suspense fallback={<PageLoader />}><PortalProfilePage /></Suspense> },
          { path: routes.portalHomeCare, element: <Suspense fallback={<PageLoader />}><PortalHomeCarePage /></Suspense> },
          { path: routes.portalTelehealth, element: <Suspense fallback={<PageLoader />}><PortalTelehealthPage /></Suspense> },
        ],
      },
    ],
  },

  {
    path: routes.login,
    element: <AuthLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [{ index: true, element: <Suspense fallback={<PageLoader />}><LoginPage /></Suspense> }],
  },

  {
    path: routes.twoFactor,
    element: <Suspense fallback={<PageLoader />}><TwoFactorPage /></Suspense>,
    errorElement: <RouteErrorBoundary />
  },
  {
    path: routes.forgotPassword,
    element: <Suspense fallback={<PageLoader />}><ForgotPasswordPage /></Suspense>,
    errorElement: <RouteErrorBoundary />
  },
  {
    path: routes.resetPassword,
    element: <Suspense fallback={<PageLoader />}><ResetPasswordPage /></Suspense>,
    errorElement: <RouteErrorBoundary />
  },

  {
    element: <ProtectedRoute />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: routes.queueDisplayBoard,
        element: <Suspense fallback={<PageLoader />}><QueueDisplayBoardPage /></Suspense>,
      },
      {
        element: <DashboardLayout />,
        children: [
          { path: routes.dashboard, element: <Suspense fallback={<PageLoader />}><TenantOverviewPage /></Suspense> },
          { path: routes.saasDashboard, element: <Suspense fallback={<PageLoader />}><SaasOverviewPage /></Suspense> },

          // Patient Flow
          { path: routes.patients, element: <Suspense fallback={<PageLoader />}><PatientListingPage /></Suspense> },
          { path: routes.patientDetail, element: <Suspense fallback={<PageLoader />}><PatientDetailPage /></Suspense> },
          { path: routes.loyalty, element: <Suspense fallback={<PageLoader />}><LoyaltyPage /></Suspense> },
          { path: routes.membershipCards, element: <Suspense fallback={<PageLoader />}><MembershipCardsPage /></Suspense> },
          { path: routes.cardFundingApprovals, element: <Suspense fallback={<PageLoader />}><CardFundingApprovalsPage /></Suspense> },
          { path: routes.patientRegister, element: <Suspense fallback={<PageLoader />}><PatientRegistrationPage /></Suspense> },

          // Visit Flow
          { path: routes.visits, element: <Suspense fallback={<PageLoader />}><VisitListPage /></Suspense> },
          { path: routes.visitInitiate, element: <Suspense fallback={<PageLoader />}><VisitInitiationPage /></Suspense> },
          { path: routes.visitFlows, element: <Suspense fallback={<PageLoader />}><VisitFlowManagementPage /></Suspense> },
          { path: routes.visitDetail, element: <Suspense fallback={<PageLoader />}><VisitDetailPage /></Suspense> },
          { path: routes.visitReroute, element: <Suspense fallback={<PageLoader />}><VisitReRoutePage /></Suspense> },
          { path: routes.homeVisits, element: <Suspense fallback={<PageLoader />}><HomeVisitsPage /></Suspense> },
          { path: routes.homeVisitDetail, element: <Suspense fallback={<PageLoader />}><HomeVisitDetailPage /></Suspense> },
          { path: routes.carePlans, element: <Suspense fallback={<PageLoader />}><CarePlansPage /></Suspense> },
          { path: routes.carePlanDetail, element: <Suspense fallback={<PageLoader />}><CarePlanDetailPage /></Suspense> },
          { path: routes.remoteMonitoring, element: <Suspense fallback={<PageLoader />}><RemoteMonitoringPage /></Suspense> },
          { path: routes.clinicalAlerts, element: <Suspense fallback={<PageLoader />}><ClinicalAlertsPage /></Suspense> },
          { path: routes.telemedicineSessions, element: <Suspense fallback={<PageLoader />}><TelemedicineSessionsPage /></Suspense> },
          { path: routes.telemedicineConsole, element: <Suspense fallback={<PageLoader />}><TelemedicineConsolePage /></Suspense> },

          // Service Delivery Points
          { path: routes.serviceDeliveryPoints, element: <Suspense fallback={<PageLoader />}><SDPListingPage /></Suspense> },
          { path: routes.interoperability, element: <Suspense fallback={<PageLoader />}><InteroperabilityPage /></Suspense> },
          { path: routes.integrations, element: <Suspense fallback={<PageLoader />}><IntegrationsPage /></Suspense> },
          { path: routes.developerAccess, element: <Suspense fallback={<PageLoader />}><DeveloperAccessPage /></Suspense> },
          { path: routes.medicalAccess, element: <Suspense fallback={<PageLoader />}><MedicalAccessConsolePage /></Suspense> },

          // Facilities / Branches
          { path: routes.facilities, element: <Suspense fallback={<PageLoader />}><FacilitiesPage /></Suspense> },

          // Queue Management
          { path: routes.queues, element: <Suspense fallback={<PageLoader />}><QueueDashboardPage /></Suspense> },
          { path: routes.queueAnalytics, element: <Suspense fallback={<PageLoader />}><QueueAnalyticsPage /></Suspense> },

          // Laboratory
          { path: routes.laboratory, element: <Navigate to={routes.labOrders} replace /> },
          { path: routes.labTests, element: <Suspense fallback={<PageLoader />}><LabTestsPage /></Suspense> },
          { path: routes.labOrders, element: <Suspense fallback={<PageLoader />}><LabOrdersPage /></Suspense> },
          { path: routes.labResults, element: <Suspense fallback={<PageLoader />}><LabResultsPage /></Suspense> },
          { path: routes.labTracker, element: <Suspense fallback={<PageLoader />}><LabResultTrackerPage /></Suspense> },

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
          { path: routes.billableServices, element: <Suspense fallback={<PageLoader />}><BillableServicesPage /></Suspense> },
          { path: routes.chartOfAccounts, element: <Suspense fallback={<PageLoader />}><ChartOfAccountsPage /></Suspense> },
          { path: routes.journalEntries, element: <Suspense fallback={<PageLoader />}><JournalEntriesPage /></Suspense> },
          { path: routes.generalLedger, element: <Suspense fallback={<PageLoader />}><GeneralLedgerPage /></Suspense> },
          { path: routes.financialReports, element: <Suspense fallback={<PageLoader />}><FinancialReportsPage /></Suspense> },
          { path: routes.payables, element: <Suspense fallback={<PageLoader />}><PayablesPage /></Suspense> },
          { path: routes.fixedAssets, element: <Suspense fallback={<PageLoader />}><FixedAssetsPage /></Suspense> },
          { path: routes.budgets, element: <Suspense fallback={<PageLoader />}><BudgetsPage /></Suspense> },
          { path: routes.billingDetail, element: <Suspense fallback={<PageLoader />}><BillingDetailPage /></Suspense> },
          { path: routes.patientPaymentGateways, element: <Suspense fallback={<PageLoader />}><PaymentGatewaysPage /></Suspense> },
          { path: routes.payments, element: <Suspense fallback={<PageLoader />}><PaymentsPage /></Suspense> },
          { path: routes.insurance, element: <Suspense fallback={<PageLoader />}><InsuranceClaimsPage /></Suspense> },
          { path: routes.insuranceDashboard, element: <Suspense fallback={<PageLoader />}><InsuranceDashboardPage /></Suspense> },
          { path: routes.insurancePayers, element: <Suspense fallback={<PageLoader />}><PayersPage /></Suspense> },
          { path: routes.insuranceEnrollees, element: <Suspense fallback={<PageLoader />}><EnrolleesPage /></Suspense> },
          { path: routes.insuranceRemittances, element: <Suspense fallback={<PageLoader />}><RemittancesPage /></Suspense> },
          { path: routes.banking, element: <Suspense fallback={<PageLoader />}><BankingPage /></Suspense> },
          { path: routes.cashOffice, element: <Suspense fallback={<PageLoader />}><CashOfficePage /></Suspense> },
          { path: routes.arDocuments, element: <Suspense fallback={<PageLoader />}><ArDocumentsPage /></Suspense> },
          { path: routes.financeReportsExt, element: <Suspense fallback={<PageLoader />}><FinanceReportsExtPage /></Suspense> },
          { path: routes.financeSettings, element: <Suspense fallback={<PageLoader />}><FinanceSettingsPage /></Suspense> },
          { path: routes.statutory, element: <Suspense fallback={<PageLoader />}><StatutoryPage /></Suspense> },

          // Pharmacy
          { path: routes.pharmacy, element: <Suspense fallback={<PageLoader />}><PharmacyQueuePage /></Suspense> },
          { path: routes.pharmacyDispense, element: <Navigate to={routes.pharmacy} replace /> },
          { path: routes.radiology, element: <Suspense fallback={<PageLoader />}><RadiologyOrdersPage /></Suspense> },

          // Admissions
          { path: routes.admissions, element: <Suspense fallback={<PageLoader />}><AdmissionsPage /></Suspense> },
          { path: routes.wards, element: <Suspense fallback={<PageLoader />}><WardsBedsPage /></Suspense> },
          { path: routes.beds, element: <Suspense fallback={<PageLoader />}><BedsPage /></Suspense> },

          // Surgery / Theatre
          { path: routes.surgery, element: <Suspense fallback={<PageLoader />}><SurgeryWorklistPage /></Suspense> },
          { path: routes.surgeryCase, element: <Suspense fallback={<PageLoader />}><SurgicalCaseDetailPage /></Suspense> },
          { path: routes.theatres, element: <Suspense fallback={<PageLoader />}><TheatresPage /></Suspense> },
          { path: routes.surgicalProcedures, element: <Suspense fallback={<PageLoader />}><ProcedureCatalogPage /></Suspense> },
          { path: routes.instrumentSets, element: <Suspense fallback={<PageLoader />}><InstrumentSetsPage /></Suspense> },

          // Ambulance
          { path: routes.ambulances, element: <Suspense fallback={<PageLoader />}><AmbulanceListingPage /></Suspense> },
          { path: routes.ambulanceDetail, element: <Suspense fallback={<PageLoader />}><AmbulanceDetailPage /></Suspense> },

          // Invitations
          { path: routes.invitations, element: <Suspense fallback={<PageLoader />}><InvitationsPage /></Suspense> },

          // SaaS Billing
          { path: routes.saasInvoices, element: <Suspense fallback={<PageLoader />}><SaaSInvoicesPage /></Suspense> },
          { path: routes.subscriptionPlans, element: <Suspense fallback={<PageLoader />}><SubscriptionPlansPage /></Suspense> },

          // Support Access
          { path: routes.supportAccess, element: <Suspense fallback={<PageLoader />}><SupportAccessPage /></Suspense> },
          { path: routes.saasPaymentConfirmations, element: <Suspense fallback={<PageLoader />}><PaymentConfirmationsPage /></Suspense> },
          { path: routes.saasPaymentsLookup, element: <Suspense fallback={<PageLoader />}><PaymentsLookupPage /></Suspense> },
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
          { path: routes.payroll, element: <Suspense fallback={<PageLoader />}><PayrollRunsPage /></Suspense> },
          { path: routes.payrollSalary, element: <Suspense fallback={<PageLoader />}><SalaryMappingPage /></Suspense> },
          { path: routes.payrollLookups, element: <Suspense fallback={<PageLoader />}><PayrollLookupsPage /></Suspense> },
          { path: routes.payrollComponents, element: <Suspense fallback={<PageLoader />}><PayrollComponentsPage /></Suspense> },
          { path: routes.payrollPensionProviders, element: <Suspense fallback={<PageLoader />}><PensionProvidersPage /></Suspense> },
          { path: routes.medicalExams, element: <Suspense fallback={<PageLoader />}><MedicalExamsPage /></Suspense> },
          { path: routes.planBilling, element: <Suspense fallback={<PageLoader />}><PlanBillingPage /></Suspense> },
          { path: routes.emailSettings, element: <Suspense fallback={<PageLoader />}><EmailSettingsPage /></Suspense> },
          { path: routes.settingsBranding, element: <Suspense fallback={<PageLoader />}><BrandingPage /></Suspense> },
          { path: routes.tenantJobs, element: <Suspense fallback={<PageLoader />}><TenantJobsPage /></Suspense> },
          { path: routes.approvals, element: <Suspense fallback={<PageLoader />}><ApprovalsListPage /></Suspense> },
          { path: routes.approvalFlows, element: <Suspense fallback={<PageLoader />}><ApprovalFlowsPage /></Suspense> },
          { path: routes.approvalRequest, element: <Suspense fallback={<PageLoader />}><ApprovalRequestPage /></Suspense> },
          { path: routes.reports, element: <Suspense fallback={<PageLoader />}><ReportsDashboardPage /></Suspense> },
          { path: routes.appointments, element: <Suspense fallback={<PageLoader />}><AppointmentsRegistryPage /></Suspense> },
          { path: routes.doctorCalendar, element: <Suspense fallback={<PageLoader />}><DoctorCalendarPage /></Suspense> },
          { path: routes.leaveRequests, element: <Suspense fallback={<PageLoader />}><LeaveRequestsPage /></Suspense> },
          { path: routes.myLeave, element: <Suspense fallback={<PageLoader />}><MyLeavePage /></Suspense> },
          { path: routes.tax, element: <Suspense fallback={<PageLoader />}><TaxDashboardPage /></Suspense> },
          { path: routes.compliance, element: <Suspense fallback={<PageLoader />}><ComplianceRecordsPage /></Suspense> },
          { path: routes.backups, element: <Suspense fallback={<PageLoader />}><DatabaseBackupsPage /></Suspense> },
          { path: routes.timesheets, element: <Suspense fallback={<PageLoader />}><TimesheetsPage /></Suspense> },
          { path: routes.staffFinance, element: <Suspense fallback={<PageLoader />}><StaffFinancePage /></Suspense> },
          { path: routes.notifications, element: <Suspense fallback={<PageLoader />}><NotificationsPage /></Suspense> },
          { path: routes.patientMessages, element: <Suspense fallback={<PageLoader />}><PatientMessagesPage /></Suspense> },
          { path: routes.sendMessage, element: <Suspense fallback={<PageLoader />}><SendMessagePage /></Suspense> },
          { path: routes.roles, element: <Suspense fallback={<PageLoader />}><RolesPage /></Suspense> },
          { path: routes.profile, element: <Suspense fallback={<PageLoader />}><ProfilePage /></Suspense> },
          { path: routes.hrAttendance, element: <Suspense fallback={<PageLoader />}><AttendancePage /></Suspense> },
          { path: routes.hrStaffRecords, element: <Suspense fallback={<PageLoader />}><StaffRecordsPage /></Suspense> },
          { path: routes.hrRoster, element: <Suspense fallback={<PageLoader />}><RosterPage /></Suspense> },
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
