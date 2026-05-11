import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { AuthLayout } from "@/app/layouts/AuthLayout";
import { DashboardLayout } from "@/app/layouts/DashboardLayout";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { TwoFactorPage } from "@/features/auth/pages/TwoFactorPage";
import { ForgotPasswordPage } from "@/features/auth/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/auth/pages/ResetPasswordPage";
import { TenantOverviewPage } from "@/features/tenant-dashboard/pages/TenantOverviewPage";
import { PatientListingPage } from "@/features/patients/pages/PatientListingPage";
import { PatientRegistrationPage } from "@/features/patients/pages/PatientRegistrationPage";
import { VisitInitiationPage } from "@/features/visits/pages/VisitInitiationPage";
import { TriagePage } from "@/features/clinical/pages/TriagePage";
import { ConsultationPage } from "@/features/clinical/pages/ConsultationPage";
import { StaffManagementPage } from "@/features/staff/pages/StaffManagementPage";
import { QueueDashboardPage } from "@/features/queues/pages/QueueDashboardPage";
import { routes } from "@/config/routes";

import { VisitFlowManagementPage } from "@/features/visits/pages/VisitFlowManagementPage";
import { VisitReRoutePage } from "@/features/visits/pages/VisitReRoutePage";
import { VisitListPage } from "@/features/visits/pages/VisitListPage";
import { VisitDetailPage } from "@/features/visits/pages/VisitDetailPage";
import { ServiceDeliveryPointsPage } from "@/features/service-delivery-points/pages/ServiceDeliveryPointsPage";
import { LandingPage } from "@/features/landing/pages/LandingPage";
import { TenantRegisterPage } from "@/features/tenants/pages/TenantRegisterPage";
import { SaasLoginPage } from "@/features/auth/pages/SaasLoginPage";
import { LabTestsPage } from "@/features/laboratory/pages/LabTestsPage";
import { LabOrdersPage } from "@/features/laboratory/pages/LabOrdersPage";
import { LabResultsPage } from "@/features/laboratory/pages/LabResultsPage";
import { DrugsPage } from "@/features/drugs/pages/DrugsPage";
import { StoresPage } from "@/features/inventory/pages/StoresPage";
import { StockItemsPage } from "@/features/inventory/pages/StockItemsPage";
import { StockMovementsPage } from "@/features/inventory/pages/StockMovementsPage";
import { PharmacyQueuePage } from "@/features/pharmacy/pages/PharmacyQueuePage";
import { AdmissionsPage } from "@/features/admissions/pages/AdmissionsPage";
import { WardsBedsPage } from "@/features/admissions/pages/WardsBedsPage";
import { BedsPage } from "@/features/admissions/pages/BedsPage";
import { TenantListPage } from "@/features/tenants/pages/TenantListPage";
import { TenantDetailPage } from "@/features/tenants/pages/TenantDetailPage";
import { TenantModulesPage } from "@/features/tenant-modules/pages/TenantModulesPage";
import { ProtectedRoute } from "./ProtectedRoute";

const router = createBrowserRouter([
  // Public landing page — default entry point
  { path: routes.home, element: <LandingPage /> },

  // Public, tenant-less pages reachable from the bare domain
  { path: routes.tenantRegister, element: <TenantRegisterPage /> },
  { path: routes.saasLogin, element: <SaasLoginPage /> },

  {
    path: routes.login,
    element: <AuthLayout />,
    children: [{ index: true, element: <LoginPage /> }],
  },

  // Public auth-lifecycle pages (no tenant context required at the URL level —
  // tenant header is auto-resolved from subdomain by the api-client).
  { path: routes.twoFactor, element: <TwoFactorPage /> },
  { path: routes.forgotPassword, element: <ForgotPasswordPage /> },
  { path: routes.resetPassword, element: <ResetPasswordPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { path: routes.dashboard, element: <TenantOverviewPage /> },
          
          // Patient Flow
          { path: routes.patients, element: <PatientListingPage /> },
          { path: routes.patientRegister, element: <PatientRegistrationPage /> },
          
          // Visit Flow
          { path: routes.visits, element: <VisitListPage /> },
          { path: routes.visitInitiate, element: <VisitInitiationPage /> },
          { path: routes.visitFlows, element: <VisitFlowManagementPage /> },
          { path: routes.visitDetail, element: <VisitDetailPage /> },
          { path: routes.visitReroute, element: <VisitReRoutePage /> },
          
          // Service Delivery Points
          { path: routes.serviceDeliveryPoints, element: <ServiceDeliveryPointsPage /> },

          // Queue Management
          { path: routes.queues, element: <QueueDashboardPage /> },

          // Laboratory
          { path: routes.laboratory, element: <Navigate to={routes.labOrders} replace /> },
          { path: routes.labTests, element: <LabTestsPage /> },
          { path: routes.labOrders, element: <LabOrdersPage /> },
          { path: routes.labResults, element: <LabResultsPage /> },

          // Drugs Catalogue
          { path: routes.drugs, element: <DrugsPage /> },

          // Inventory
          { path: routes.inventory, element: <Navigate to={routes.inventoryStores} replace /> },
          { path: routes.inventoryStores, element: <StoresPage /> },
          { path: routes.inventoryItems, element: <StockItemsPage /> },
          { path: routes.inventoryMovements, element: <StockMovementsPage /> },

          // Pharmacy
          { path: routes.pharmacy, element: <PharmacyQueuePage /> },
          { path: routes.pharmacyDispense, element: <Navigate to={routes.pharmacy} replace /> },

          // Admissions
          { path: routes.admissions, element: <AdmissionsPage /> },
          { path: routes.wards, element: <WardsBedsPage /> },
          { path: routes.beds, element: <BedsPage /> },

          // SaaS Tenant Management
          { path: routes.tenants, element: <TenantListPage /> },
          { path: routes.tenantDetail, element: <TenantDetailPage /> },
          { path: routes.tenantModules, element: <TenantModulesPage /> },
          
          // Clinical Flow
          { path: routes.clinical, element: <Navigate to={routes.dashboard} replace /> },
          { path: `${routes.triage}/:visitId`, element: <TriagePage /> },
          { path: `${routes.consultation}/:visitId`, element: <ConsultationPage /> },
          
          // Administrative
          { path: routes.staff, element: <StaffManagementPage /> },
        ],
      },
    ],
  },
]);




export function AppRouter() {
  return <RouterProvider router={router} />;
}
