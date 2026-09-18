import { routes } from "@/config/routes";
import { isDedicatedDeployment } from "@/config/env";
import { ClipboardCheck, BookOpenCheck, BookOpen, Scale, KeyRound, 
  LayoutDashboard, 
  Users, 
  Stethoscope, 
  Video,
  ClipboardList, 
  FlaskConical, 
  Activity, 
  Pill, 
  Bed, 
  Receipt, 
  CreditCard, 
  Banknote, 
  ShieldCheck, 
  Package, 
  Calendar, 
  UserRound, 
  Clock, 
  Timer, 
  Briefcase, 
  Wallet, 
  Percent, 
  CheckSquare, 
  BarChart3,
  Settings,
  Globe,
  Layers,
  Building2,
  Hospital,
  Truck,
  Mail,
  Gift,
  ShoppingCart,
  Database,
  FileText,
  MessageSquare,
  CalendarClock,
  Fingerprint,
  Scissors,
  Boxes,
  Send,
} from "lucide-react";

export type AppModule = {
  code: string;
  label: string;
  path: string;
  description: string;
  icon: any;
  category: "Core" | "Clinical" | "Administrative" | "Financial" | "HR & Payroll" | "SaaS";
  /**
   * Backend subscription-module code gating this entry
   * (matches /tenant-modules/me/list codes). Omit for always-on core modules.
   */
  moduleCode?: string;
  /**
   * Permission codes (from /permissions/me) that grant access to this entry.
   * ANY-match — the user needs at least one. Omit for entries whose pages are
   * open to any authenticated user (no server-side permission enforcement),
   * so they are never hidden. Populated below from MENU_PERMISSIONS.
   */
  permissions?: string[];
};

//: Modules that only exist on the multi-tenant SaaS platform. On a
//: dedicated (single-hospital) install these are hidden — the backend also
//: refuses their APIs with 404 in that mode.
const SAAS_ONLY_MODULE_CODES = new Set([
  "PLAN_BILLING",       // subscription plan & invoices — dedicated pays an annual licence
  "TENANT_DOMAINS",     // white-label domains are a platform feature
  "DEVELOPER_ACCESS",   // third-party developer platform (SaaS level)
]);

const allModules: AppModule[] = [
  // Core
  { code: "DASHBOARD", label: "Dashboard", path: routes.dashboard, icon: LayoutDashboard, category: "Core", description: "Tenant operational overview." },
  { code: "APPROVALS", label: "All Requests", path: routes.approvals, icon: CheckSquare, category: "Core", description: "Requests, approvals and decisions." },
  { code: "APPROVAL_FLOWS", label: "Approval Flows", path: routes.approvalFlows, icon: CheckSquare, category: "Core", description: "Configure request types, approval flows and steps." },
  
  // Clinical
  { code: "PATIENTS", label: "Patients", path: routes.patients, icon: Users, category: "Clinical", description: "Patient registration and records." },
  { code: "LOYALTY", label: "Loyalty Rewards", path: routes.loyalty, icon: Gift, category: "Clinical", description: "Track and manage patient reward points." },
  { code: "VISITS", label: "Visits", path: routes.visits, icon: ClipboardList, category: "Clinical", description: "Patient visit lifecycle." },
  { code: "INTEROPERABILITY", label: "Interoperability", path: routes.interoperability, icon: Hospital, category: "Clinical", description: "Refer patients and exchange records with other hospitals." },
  { code: "MEDICAL_ACCESS", label: "Record Sharing", path: routes.medicalAccess, icon: ShieldCheck, category: "Clinical", description: "Request and authorize consent-gated access to patient medical histories with secure one-time links." },
  { code: "QUEUES", label: "Queues", path: routes.queues, icon: Clock, category: "Clinical", description: "Service delivery point queues." },
  { code: "QUEUE_ANALYTICS", label: "Queue Analytics", path: routes.queueAnalytics, icon: BarChart3, category: "Clinical", description: "Wait times, throughput and no-show rates per service point." },
  { code: "QUEUE_DISPLAY", label: "Queue Display", path: routes.queueDisplayBoard, icon: LayoutDashboard, category: "Clinical", description: "Full-screen waiting-room now-serving board." },
  { code: "CLINICAL", moduleCode: "clinical", label: "Clinical", path: routes.clinical, icon: Stethoscope, category: "Clinical", description: "Triage, vitals, consultation, diagnosis." },
  { code: "HOME_VISITS", label: "Home Visits", path: routes.homeVisits, icon: ClipboardList, category: "Clinical", description: "Schedule, dispatch and document domiciliary visits." },
  { code: "CARE_PLANS", label: "Care Plans", path: routes.carePlans, icon: ClipboardCheck, category: "Clinical", description: "Care-plan goals, interventions, tasks and reviews." },
  { code: "REMOTE_MONITORING", label: "Remote Monitoring", path: routes.remoteMonitoring, icon: Activity, category: "Clinical", description: "Home vitals capture, trends and device data." },
  { code: "CLINICAL_ALERTS", label: "Clinical Alerts", path: routes.clinicalAlerts, icon: ShieldCheck, category: "Clinical", description: "Early-warning alerts, triage and escalation." },
  { code: "TELEMEDICINE", label: "Telemedicine", path: routes.telemedicineSessions, icon: Video, category: "Clinical", description: "Virtual consultations — video, audio and chat with SOAP notes." },
  { code: "LAB", moduleCode: "laboratory", label: "Laboratory", path: routes.labOrders, icon: FlaskConical, category: "Clinical", description: "Lab orders and results." },
  { code: "LAB_TRACKER", moduleCode: "laboratory", label: "Lab Result Tracker", path: routes.labTracker, icon: ClipboardList, category: "Clinical", description: "Track lab orders hospital-wide and download released reports." },
  { code: "RADIOLOGY", moduleCode: "radiology", label: "Radiology", path: routes.radiology, icon: Activity, category: "Clinical", description: "Radiology orders and reports." },
  { code: "PHARMACY", moduleCode: "pharmacy", label: "Pharmacy", path: routes.pharmacy, icon: Pill, category: "Clinical", description: "Prescriptions and dispensing." },
  { code: "DRUGS", moduleCode: "pharmacy", label: "Drugs", path: routes.drugs, icon: Pill, category: "Administrative", description: "Drug formulary and categories." },
  { code: "ADMISSIONS", moduleCode: "inpatient", label: "Admissions", path: routes.admissions, icon: Bed, category: "Clinical", description: "Ward, bed, admission and discharge." },
  { code: "AMBULANCE", moduleCode: "ambulance", label: "Ambulance", path: routes.ambulances, icon: Truck, category: "Clinical", description: "Fleet management, driver certifications and readiness." },
  { code: "WARDS", moduleCode: "inpatient", label: "Wards", path: routes.wards, icon: Hospital, category: "Clinical", description: "Ward configuration and live bed occupancy." },
  { code: "BEDS", moduleCode: "inpatient", label: "Beds", path: routes.beds, icon: Bed, category: "Clinical", description: "Bed inventory across every ward." },
  { code: "MEDICATION_ADHERENCE", moduleCode: "pharmacy", label: "Medication Adherence", path: routes.medicationAdherence, icon: Timer, category: "Clinical", description: "Dose schedules, alerts, refills and follow-ups." },
  { code: "SURGERY_WORKLIST", moduleCode: "surgical", label: "Surgery Worklist", path: routes.surgery, icon: Scissors, category: "Clinical", description: "Theatre schedule and live surgical case tracking." },
  { code: "THEATRES", moduleCode: "surgical", label: "Theatres", path: routes.theatres, icon: Building2, category: "Clinical", description: "Operating theatres and availability." },
  { code: "SURGICAL_PROCEDURES", moduleCode: "surgical", label: "Procedure Catalog", path: routes.surgicalProcedures, icon: ClipboardList, category: "Clinical", description: "Surgical procedure catalog and pricing." },
  { code: "INSTRUMENT_SETS", moduleCode: "surgical", label: "Instrument Sets", path: routes.instrumentSets, icon: Boxes, category: "Clinical", description: "Instrument sets, sterilization and assignment." },

  // Financial
  { code: "BILLING", moduleCode: "billing", label: "Billing", path: routes.billing, icon: Receipt, category: "Financial", description: "Invoices, billing and charges." },
  { code: "PATIENT_PAYMENT", moduleCode: "billing", label: "Payment Gateways", path: routes.patientPaymentGateways, icon: CreditCard, category: "Financial", description: "Configure direct patient payment integrations." },
  { code: "PAYMENTS", moduleCode: "billing", label: "Payments", path: routes.payments, icon: CreditCard, category: "Financial", description: "Cash, transfer, gateway and membership card payments." },
  { code: "CARD_FUNDING_APPROVALS", label: "Card Funding", path: routes.cardFundingApprovals, icon: Banknote, category: "Financial", description: "Confirm patient-submitted manual card wallet top-ups." },
  { code: "INSURANCE", moduleCode: "insurance", label: "Insurance", path: routes.insurance, icon: ShieldCheck, category: "Financial", description: "Insurance claims and confirmations." },
  { code: "INSURANCE_DASHBOARD", moduleCode: "insurance", label: "Insurance Dashboard", path: routes.insuranceDashboard, icon: ShieldCheck, category: "Financial", description: "HMO receivables, claim aging, rejections and capitation KPIs." },
  { code: "HMO_PAYERS", moduleCode: "insurance", label: "HMO Payers", path: routes.insurancePayers, icon: Briefcase, category: "Financial", description: "Payers, plans, benefit rules, tariffs, capitation and statements." },
  { code: "ENROLLEES", moduleCode: "insurance", label: "Enrollees & Eligibility", path: routes.insuranceEnrollees, icon: UserRound, category: "Financial", description: "Front-desk enrollee lookup, eligibility checks and plan linking." },
  { code: "REMITTANCES", moduleCode: "insurance", label: "Remittances", path: routes.insuranceRemittances, icon: Banknote, category: "Financial", description: "Bulk HMO payments allocated to claims and capitation." },
  { code: "BANKING", moduleCode: "billing", label: "Banking", path: routes.banking, icon: Wallet, category: "Financial", description: "Bank accounts, deposits, transfers and reconciliation." },
  { code: "CASH_OFFICE", moduleCode: "billing", label: "Cash Office", path: routes.cashOffice, icon: Banknote, category: "Financial", description: "Petty cash floats, vouchers and cashier shifts." },
  { code: "AR_DOCUMENTS", moduleCode: "billing", label: "Credit Notes & Refunds", path: routes.arDocuments, icon: Receipt, category: "Financial", description: "Credit notes, refunds and bad-debt write-offs." },
  { code: "FINANCE_REPORTS_EXT", moduleCode: "billing", label: "Reports+", path: routes.financeReportsExt, icon: Scale, category: "Financial", description: "Cash flow, general ledger, departmental P&L and posting health." },
  { code: "FINANCE_SETTINGS", moduleCode: "billing", label: "Finance Settings", path: routes.financeSettings, icon: BookOpenCheck, category: "Financial", description: "Chart of accounts, system posting map, cost centers and controls." },
  { code: "STATUTORY", moduleCode: "billing", label: "Statutory Remittances", path: routes.statutory, icon: Scale, category: "Financial", description: "PAYE, pension, NHF, WHT and VAT liabilities, remittances and filing schedules." },
  { code: "PAYROLL", moduleCode: "hr", label: "Payroll", path: routes.payroll, icon: Wallet, category: "HR & Payroll", description: "Payroll runs, lines and approvals." },
  { code: "TAX", moduleCode: "billing", label: "Tax", path: routes.tax, icon: Percent, category: "Financial", description: "Tax rates, rules, exemptions and reports." },
  { code: "BILLABLE_SERVICES", moduleCode: "billing", label: "Billable Services", path: routes.billableServices, icon: Banknote, category: "Financial", description: "Service catalogue: rates and posting accounts." },
  { code: "CHART_OF_ACCOUNTS", moduleCode: "billing", label: "Chart of Accounts", path: routes.chartOfAccounts, icon: Layers, category: "Financial", description: "Ledger accounts that services post to." },
  { code: "JOURNAL_ENTRIES", moduleCode: "billing", label: "Journal Entries", path: routes.journalEntries, icon: BookOpenCheck, category: "Financial", description: "Double-entry journal: create, post and reverse ledger entries." },
  { code: "GENERAL_LEDGER", moduleCode: "billing", label: "General Ledger", path: routes.generalLedger, icon: BookOpen, category: "Financial", description: "Per-account activity with running balances." },
  { code: "FINANCIAL_REPORTS", moduleCode: "billing", label: "Financial Reports", path: routes.financialReports, icon: Scale, category: "Financial", description: "Trial balance, profit & loss, balance sheet and periods." },
  { code: "PAYABLES", moduleCode: "billing", label: "Accounts Payable", path: routes.payables, icon: Receipt, category: "Financial", description: "Vendors, supplier bills, payments and AP ageing." },
  { code: "FIXED_ASSETS", moduleCode: "billing", label: "Fixed Assets", path: routes.fixedAssets, icon: Boxes, category: "Financial", description: "Asset register and monthly depreciation posting." },
  { code: "BUDGETS", moduleCode: "billing", label: "Budgets", path: routes.budgets, icon: Gift, category: "Financial", description: "Monthly budgets per account with budget-vs-actual variance." },

  // Administrative
  { code: "FACILITIES", label: "Branches", path: routes.facilities, icon: Hospital, category: "Administrative", description: "Manage hospital branches, clinics and service sites." },
  { code: "SERVICE_DELIVERY_POINTS", label: "Service Points", path: routes.serviceDeliveryPoints, icon: Building2, category: "Administrative", description: "Configure clinical service delivery points and queue prefixes." },
  { code: "INTEGRATIONS", label: "Integrations & API Keys", path: routes.integrations, icon: Boxes, category: "Administrative", description: "Connect third-party hospital applications for two-way data exchange." },
  { code: "DEVELOPER_ACCESS", label: "Developer Access", path: routes.developerAccess, icon: KeyRound, category: "Administrative", description: "Approve third-party developers requesting your patient data via API." },
  { code: "INVENTORY", moduleCode: "inventory", label: "Stores", path: routes.inventoryStores, icon: Package, category: "Administrative", description: "Stores, stock, items and alerts." },
  { code: "APPOINTMENTS", moduleCode: "appointments", label: "Appointments", path: routes.appointments, icon: Calendar, category: "Administrative", description: "Appointment scheduling and reminders." },
  { code: "DOCTOR_CALENDAR", moduleCode: "appointments", label: "Doctor Calendar", path: routes.doctorCalendar, icon: UserRound, category: "Administrative", description: "Doctor slots, workload and time off." },
  { code: "STAFF", label: "Staff", path: routes.staff, icon: UserRound, category: "HR & Payroll", description: "Hospital personnel management." },
  { code: "INVITATIONS", label: "Invitations", path: routes.invitations, icon: Mail, category: "HR & Payroll", description: "Manage staff invitations and onboarding." },
  { code: "HR", moduleCode: "hr", label: "Overview", path: routes.hr, icon: Briefcase, category: "HR & Payroll", description: "Staff profiles, onboarding, roster, attendance and leave." },
  { code: "HR_ROSTER", moduleCode: "hr", label: "Duty Roster", path: routes.hrRoster, icon: CalendarClock, category: "HR & Payroll", description: "Shift definitions and weekly staff duty roster by department or unit." },
  { code: "HR_ATTENDANCE", moduleCode: "hr", label: "Attendance", path: routes.hrAttendance, icon: Fingerprint, category: "HR & Payroll", description: "Staff clock-in / clock-out and attendance tracking." },
  { code: "HR_STAFF_RECORDS", moduleCode: "hr", label: "Staff Records", path: routes.hrStaffRecords, icon: UserRound, category: "HR & Payroll", description: "HR directory: update employment, salary and banking per staff member." },
  { code: "REPORTS", moduleCode: "reporting", label: "Reports", path: routes.reports, icon: BarChart3, category: "Administrative", description: "Operational and management reports." },
  { code: "EMAIL_SETTINGS", label: "Email Setup", path: routes.emailSettings, icon: Mail, category: "Administrative", description: "Configure system-wide SMTP and email notification settings." },
  { code: "TENANT_JOBS", label: "Background Jobs", path: routes.tenantJobs, icon: Clock, category: "Administrative", description: "Manage automated tasks and maintenance schedules." },
  { code: "PLAN_BILLING", label: "Plan & Billing", path: routes.planBilling, icon: CreditCard, category: "Administrative", description: "Subscription plan, upgrades and invoices." },
  { code: "SETTINGS", label: "General", path: routes.settings, icon: Settings, category: "Administrative", description: "Tenant configuration." },

  // SaaS
  { code: "SAAS_DASHBOARD", label: "Overview", path: routes.saasDashboard, icon: LayoutDashboard, category: "SaaS", description: "Global performance metrics and tenant analytics." },
  { code: "TENANTS", label: "Tenants", path: routes.tenants, icon: Globe, category: "SaaS", description: "SaaS Tenant management." },
  { code: "SUBSCRIPTION_PLANS", label: "Subscription Plans", path: routes.subscriptionPlans, icon: Layers, category: "SaaS", description: "Create, price and manage subscription plan tiers." },
  { code: "TENANT_DOMAINS", label: "Custom Domains", path: routes.tenantDomains, icon: Globe, category: "SaaS", description: "Manage white-label domains and SSL." },
  { code: "SAAS_BILLING", label: "Subscription", path: routes.saasInvoices, icon: CreditCard, category: "SaaS", description: "Manage platform subscription and invoices." },
  { code: "PAYMENT_CONFIRMATIONS", label: "Payment Confirmations", path: routes.saasPaymentConfirmations, icon: Banknote, category: "SaaS", description: "Confirm manual tenant subscription payments." },
  { code: "PAYMENTS_LOOKUP", label: "Payment Lookup", path: routes.saasPaymentsLookup, icon: Receipt, category: "SaaS", description: "Search and review confirmed tenant payments." },
  { code: "SUPPORT_ACCESS", label: "Support Access", path: routes.supportAccess, icon: ShieldCheck, category: "SaaS", description: "Grant temporary platform access to support staff." },
  { code: "CONNECTIVITY", label: "System Health", path: routes.connectivity, icon: Activity, category: "SaaS", description: "Monitor platform connectivity and global uptime." },
  { code: "TENANT_MODULES", label: "Modules", path: routes.tenantModules, icon: Layers, category: "SaaS", description: "Module management." },
  
  // New Administrative & Operations
  { code: "PROCUREMENT", moduleCode: "inventory", label: "Procurement", path: routes.procurement, icon: ShoppingCart, category: "Administrative", description: "Requisitions and purchase orders." },
  { code: "COMPLIANCE", moduleCode: "compliance", label: "Compliance", path: routes.compliance, icon: ShieldCheck, category: "Administrative", description: "Audit records and certifications." },
  { code: "BACKUPS", label: "Backups", path: routes.backups, icon: Database, category: "Administrative", description: "System recovery points." },
  { code: "TIMESHEETS", moduleCode: "hr", label: "My Timesheets", path: routes.timesheets, icon: Timer, category: "HR & Payroll", description: "Log your own hours day by day and route them for approval." },
  { code: "STAFF_FINANCE", moduleCode: "hr", label: "Staff Finance", path: routes.staffFinance, icon: Wallet, category: "HR & Payroll", description: "Advances and reimbursements." },
  { code: "LEAVE_REQUESTS", moduleCode: "hr", label: "Leave Mgmt", path: routes.leaveRequests, icon: Calendar, category: "HR & Payroll", description: "Staff leave applications." },
  { code: "MY_LEAVE", moduleCode: "hr", label: "My Leave", path: routes.myLeave, icon: Calendar, category: "HR & Payroll", description: "Request time off and track your approvals." },
  { code: "CLINICAL_TEMPLATES", moduleCode: "clinical", label: "Templates", path: routes.clinicalTemplates, icon: FileText, category: "Clinical", description: "Clinical documentation templates." },
  { code: "MEMBERSHIP_CARDS", label: "ID Cards", path: routes.membershipCards, icon: CreditCard, category: "Clinical", description: "Patient identification cards." },
  { code: "ROLES", label: "Roles & Permissions", path: routes.roles, icon: ShieldCheck, category: "Administrative", description: "Access control roles and permission matrix." },
  { code: "NOTIFICATIONS", label: "Notifications", path: routes.notifications, icon: Mail, category: "Administrative", description: "System notification inbox and delivery log." },
  { code: "PATIENT_MESSAGES", label: "Patient Messages", path: routes.patientMessages, icon: MessageSquare, category: "Clinical", description: "Secure messages sent in by patients from the portal." },
  { code: "SEND_MESSAGE", label: "Send Message", path: routes.sendMessage, icon: Send, category: "Clinical", description: "Send announcements to one patient, a group, or all registered patients." },
  { code: "MEDICAL_EXAMS", moduleCode: "clinical", label: "Medical Exams", path: routes.medicalExams, icon: ClipboardCheck, category: "Clinical", description: "Fitness assessments: packages, investigations and verifiable reports." },
];

export const appModules: AppModule[] = isDedicatedDeployment
  ? allModules.filter(
      (m) => m.category !== "SaaS" && !SAAS_ONLY_MODULE_CODES.has(m.code),
    )
  : allModules;

/**
 * Menu-item → permission codes required to *see* it. Each list mirrors the
 * exact ``require_permission(...)`` codes enforced by that area's read/list
 * endpoints (ANY-match, superusers bypass). Entries NOT listed here have no
 * server-side permission gate and stay visible to any authenticated user, so
 * we never hide something a role can actually use.
 */
const MENU_PERMISSIONS: Record<string, string[]> = {
  // Home Health
  HOME_VISITS: ["HOME_VISIT_READ", "HOME_VISIT_CREATE", "HOME_VISIT_UPDATE", "HOME_VISIT_DOCUMENT", "HOME_VISIT_ASSIGN"],
  CARE_PLANS: ["CARE_PLAN_READ", "CARE_PLAN_CREATE", "CARE_PLAN_UPDATE", "CARE_PLAN_MANAGE"],
  REMOTE_MONITORING: ["REMOTE_MONITORING_READ", "REMOTE_MONITORING_RECORD", "REMOTE_MONITORING_MANAGE"],
  CLINICAL_ALERTS: ["CLINICAL_ALERT_READ", "CLINICAL_ALERT_MANAGE"],
  TELEMEDICINE: ["TELEMEDICINE_READ", "TELEMEDICINE_CREATE", "TELEMEDICINE_UPDATE", "TELEMEDICINE_CONDUCT"],
  // Clinical
  CLINICAL: ["CONSULTATION_READ", "CONSULTATION_WRITE", "TRIAGE_PERFORM", "VITAL_SIGN_RECORD", "DIAGNOSIS_WRITE", "VISIT_READ"],
  CLINICAL_TEMPLATES: ["TEMPLATE_READ", "TEMPLATE_CREATE"],
  LAB: ["LAB_ORDER_CREATE", "LAB_RESULT_ENTER", "LAB_RESULT_VERIFY", "LAB_RESULT_RELEASE"],
  LAB_TRACKER: ["VISIT_READ", "PATIENT_READ", "LAB_ORDER_CREATE", "LAB_RESULT_ENTER", "LAB_RESULT_VERIFY", "LAB_RESULT_RELEASE"],
  RADIOLOGY: ["RADIOLOGY_ORDER", "RADIOLOGY_PERFORM", "RADIOLOGY_REPORT", "RADIOLOGY_RELEASE", "RADIOLOGY_MANAGE"],
  PHARMACY: ["PRESCRIPTION_DISPENSE", "PHARMACY_STOCK_MANAGE", "INVENTORY_READ"],
  ADMISSIONS: ["ADMISSION_CREATE", "ADMISSION_DISCHARGE", "BED_MANAGE", "VISIT_READ", "BILLING_READ"],
  AMBULANCE: ["AMBULANCE_READ", "AMBULANCE_MANAGE", "DISPATCH_READ", "DISPATCH_MANAGE"],
  MEMBERSHIP_CARDS: ["PATIENT_CARD_VIEW", "PATIENT_CARD_CREATE", "PATIENT_CARD_UPDATE", "PATIENT_CARD_FUND", "PATIENT_CARD_DEBIT"],
  // Surgery (codes match each list endpoint's require_permission exactly)
  SURGERY_WORKLIST: ["SURGICAL_READ", "SURGICAL_PERFORM"],
  THEATRES: ["SURGICAL_READ", "THEATRE_MANAGE"],
  SURGICAL_PROCEDURES: ["SURGICAL_READ", "SURGICAL_BOOK", "SURGICAL_PERFORM"],
  INSTRUMENT_SETS: ["SURGICAL_READ", "INSTRUMENT_MANAGE"],
  // Administrative / operations
  APPOINTMENTS: ["APPOINTMENT_READ", "APPOINTMENT_CREATE", "APPOINTMENT_UPDATE", "APPOINTMENT_CANCEL"],
  INVENTORY: ["INVENTORY_READ", "INVENTORY_MANAGE", "STOCK_MOVEMENT_POST"],
  DRUGS: ["INVENTORY_READ", "INVENTORY_MANAGE", "PHARMACY_STOCK_MANAGE", "PRESCRIPTION_WRITE", "PRESCRIPTION_DISPENSE"],
  FACILITIES: ["FACILITY_READ", "FACILITY_CREATE", "FACILITY_UPDATE"],
  REPORTS: ["REPORT_READ", "REPORT_GENERATE"],
  COMPLIANCE: ["COMPLIANCE_READ", "COMPLIANCE_MANAGE", "ACCREDITATION_READ", "INCIDENT_READ", "INFECTION_LOG_READ", "QUALITY_PROJECT_READ", "GOVERNANCE_DASHBOARD"],
  NOTIFICATIONS: ["NOTIFICATION_READ", "NOTIFICATION_MANAGE", "NOTIFICATION_DISPATCH", "MESSAGE_SEND"],
  SEND_MESSAGE: ["MESSAGE_SEND"],
  // Financial
  BILLING: ["BILLING_READ", "BILLING_CREATE", "PAYMENT_RECEIVE", "INVOICE_ISSUE", "INVOICE_VOID"],
  PAYMENTS: ["BILLING_READ", "PAYMENT_RECEIVE", "PAYMENT_REFUND"],
  INSURANCE: ["CLAIM_READ", "CLAIM_MANAGE", "CLAIM_REVIEW"],
  DEVELOPER_ACCESS: ["DEVELOPER_ACCESS_MANAGE"],
  MEDICAL_ACCESS: ["MEDICAL_ACCESS_REQUEST", "MEDICAL_ACCESS_REVIEW"],
  JOURNAL_ENTRIES: ["ACCOUNTING_READ", "ACCOUNTING_POST", "ACCOUNTING_MANAGE"],
  GENERAL_LEDGER: ["ACCOUNTING_READ", "ACCOUNTING_POST", "ACCOUNTING_MANAGE"],
  FINANCIAL_REPORTS: ["ACCOUNTING_READ", "ACCOUNTING_POST", "ACCOUNTING_MANAGE"],
  PAYABLES: ["ACCOUNTING_READ", "ACCOUNTING_POST", "ACCOUNTING_MANAGE"],
  FIXED_ASSETS: ["ACCOUNTING_READ", "ACCOUNTING_POST", "ACCOUNTING_MANAGE"],
  BUDGETS: ["ACCOUNTING_READ", "ACCOUNTING_POST", "ACCOUNTING_MANAGE"],
}

for (const m of appModules) {
  const perms = MENU_PERMISSIONS[m.code];
  if (perms) m.permissions = perms;
}


/**
 * Logical sub-menus. A group renders as an expandable parent in the sidebar;
 * its ``children`` (module codes, in display order) are nested underneath.
 * A group only shows when at least one of its children is visible for the
 * tenant. Any module NOT listed in a group stays a top-level item.
 */
export type NavGroup = {
  code: string;
  label: string;
  icon: any;
  category: AppModule["category"];
  description?: string;
  children: string[];
};

export const navGroups: NavGroup[] = [
  {
    code: "GRP_REQUESTS",
    label: "Requests",
    icon: CheckSquare,
    category: "Core",
    description: "All requests, approvals and flow configuration.",
    children: ["APPROVALS", "APPROVAL_FLOWS"],
  },
  {
    code: "GRP_SURGERY",
    label: "Surgery & Theatre",
    icon: Scissors,
    category: "Clinical",
    description: "Surgical worklist, theatres, procedure catalog and instruments.",
    children: ["SURGERY_WORKLIST", "THEATRES", "SURGICAL_PROCEDURES", "INSTRUMENT_SETS"],
  },
  {
    code: "GRP_HOME_HEALTH",
    label: "Home Health",
    icon: Stethoscope,
    category: "Clinical",
    description: "Home visits, care plans, remote monitoring and clinical alerts.",
    children: ["HOME_VISITS", "CARE_PLANS", "REMOTE_MONITORING", "CLINICAL_ALERTS", "TELEMEDICINE"],
  },
  {
    code: "GRP_HR",
    label: "Human Resources",
    icon: Briefcase,
    category: "HR & Payroll",
    description: "People, roster, attendance, leave and staff finance.",
    children: [
      "MY_LEAVE",
      "HR",
      "STAFF",
      "HR_STAFF_RECORDS",
      "INVITATIONS",
      "HR_ROSTER",
      "HR_ATTENDANCE",
      "LEAVE_REQUESTS",
      "TIMESHEETS",
      "STAFF_FINANCE",
    ],
  },
  {
    code: "GRP_INVENTORY",
    label: "Inventory & Supply",
    icon: Package,
    category: "Administrative",
    description: "Stores, stock, procurement and drug formulary.",
    children: ["INVENTORY", "PROCUREMENT", "DRUGS"],
  },
  {
    code: "GRP_SCHEDULING",
    label: "Scheduling",
    icon: Calendar,
    category: "Administrative",
    description: "Appointments and doctor calendars.",
    children: ["APPOINTMENTS", "DOCTOR_CALENDAR"],
  },
  {
    code: "GRP_FACILITIES",
    label: "Facilities",
    icon: Hospital,
    category: "Administrative",
    description: "Branches and service delivery points.",
    children: ["FACILITIES", "SERVICE_DELIVERY_POINTS"],
  },
  {
    code: "GRP_COMMUNICATIONS",
    label: "Communications",
    icon: MessageSquare,
    category: "Clinical",
    description: "Send announcements to patients and read messages they send in.",
    children: ["SEND_MESSAGE", "PATIENT_MESSAGES"],
  },
  {
    code: "GRP_SYSTEM",
    label: "System & Settings",
    icon: Settings,
    category: "Administrative",
    description: "Tenant configuration, access control and maintenance.",
    children: [
      "SETTINGS",
      "ROLES",
      "EMAIL_SETTINGS",
      "TENANT_JOBS",
      "PLAN_BILLING",
      "BACKUPS",
      "NOTIFICATIONS",
      "COMPLIANCE",
    ],
  },
];


/**
 * Route-prefix → subscription-module map used by the layout guard.
 * A path matching a prefix requires the mapped module to be effective
 * for the tenant; unlisted paths are always accessible.
 */
export const PATH_MODULE_MAP: Array<{ prefix: string; module: string }> = [
  { prefix: "/laboratory", module: "laboratory" },
  { prefix: "/radiology", module: "radiology" },
  { prefix: "/pharmacy", module: "pharmacy" },
  { prefix: "/drugs", module: "pharmacy" },
  { prefix: "/medication-adherence", module: "pharmacy" },
  { prefix: "/clinical", module: "clinical" },
  { prefix: "/admissions", module: "inpatient" },
  { prefix: "/surgery", module: "surgical" },
  { prefix: "/wards", module: "inpatient" },
  { prefix: "/beds", module: "inpatient" },
  { prefix: "/ambulances", module: "ambulance" },
  { prefix: "/billing", module: "billing" },
  { prefix: "/payments", module: "billing" },
  { prefix: "/tax", module: "billing" },
  { prefix: "/insurance", module: "insurance" },
  { prefix: "/inventory", module: "inventory" },
  { prefix: "/appointments", module: "appointments" },
  { prefix: "/doctor-calendar", module: "appointments" },
  { prefix: "/hr", module: "hr" },
  { prefix: "/payroll", module: "hr" },
  { prefix: "/staff/timesheets", module: "hr" },
  { prefix: "/staff/finance", module: "hr" },
  { prefix: "/compliance", module: "compliance" },
  { prefix: "/reports", module: "reporting" },
];

/** Resolve the module required for a pathname, or null when ungated. */
export function moduleForPath(pathname: string): string | null {
  const hit = PATH_MODULE_MAP.find(
    (e) => pathname === e.prefix || pathname.startsWith(e.prefix + "/")
  );
  return hit ? hit.module : null;
}
