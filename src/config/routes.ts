export const routes = {
  home: "/",
  login: "/login",
  saasLogin: "/saas/login",
  tenantRegister: "/register-hospital",
  twoFactor: "/two-factor",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",

  dashboard: "/dashboard",
  saasDashboard: "/saas",
  tenants: "/tenants",
  tenantDetail: "/tenants/:tenantId",
  tenantModules: "/tenant-modules",
  tenantDomains: "/tenant-domains",

  patients: "/patients",
  patientRegister: "/patients/register",
  patientSearch: "/patients/search",
  
  visits: "/visits",
  visitInitiate: "/visits/initiate",
  visitFlows: "/visits/flows",
  visitDetail: "/visits/:visitId",
  visitReroute: "/visits/:visitId/reroute",

  serviceDeliveryPoints: "/service-delivery-points",


  
  queues: "/queues",
  
  clinical: "/clinical",
  triage: "/clinical/triage",
  consultation: "/clinical/consultation",
  vitals: "/clinical/vitals",

  laboratory: "/laboratory",
  labOrders: "/laboratory/orders",
  labResults: "/laboratory/results",
  labTests: "/laboratory/tests",

  radiology: "/radiology",
  pharmacy: "/pharmacy",
  pharmacyDispense: "/pharmacy/dispense",

  admissions: "/admissions",
  wards: "/wards",
  beds: "/beds",
  billing: "/billing",
  payments: "/payments",
  insurance: "/insurance",
  inventory: "/inventory",
  inventoryStores: "/inventory/stores",
  inventoryItems: "/inventory/items",
  inventoryMovements: "/inventory/movements",
  drugs: "/drugs",
  appointments: "/appointments",
  doctorCalendar: "/doctor-calendar",
  medicationAdherence: "/medication-adherence",
  
  staff: "/staff",
  hr: "/hr",
  payroll: "/payroll",
  tax: "/tax",
  
  approvals: "/approvals",
  reports: "/reports",
  settings: "/settings",
} as const;

