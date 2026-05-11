import { routes } from "@/config/routes";
import { 
  LayoutDashboard, 
  Users, 
  Stethoscope, 
  ClipboardList, 
  FlaskConical, 
  Activity, 
  Pill, 
  Bed, 
  Receipt, 
  CreditCard, 
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
  Hospital
} from "lucide-react";

export type AppModule = {
  code: string;
  label: string;
  path: string;
  description: string;
  icon: any;
  category: "Core" | "Clinical" | "Administrative" | "Financial" | "SaaS";
};

export const appModules: AppModule[] = [
  // Core
  { code: "DASHBOARD", label: "Dashboard", path: routes.dashboard, icon: LayoutDashboard, category: "Core", description: "Tenant operational overview." },
  
  // Clinical
  { code: "PATIENTS", label: "Patients", path: routes.patients, icon: Users, category: "Clinical", description: "Patient registration and records." },
  { code: "VISITS", label: "Visits", path: routes.visits, icon: ClipboardList, category: "Clinical", description: "Patient visit lifecycle." },
  { code: "QUEUES", label: "Queues", path: routes.queues, icon: Clock, category: "Clinical", description: "Service delivery point queues." },
  { code: "CLINICAL", label: "Clinical", path: routes.clinical, icon: Stethoscope, category: "Clinical", description: "Triage, vitals, consultation, diagnosis." },
  { code: "LAB", label: "Laboratory", path: routes.labOrders, icon: FlaskConical, category: "Clinical", description: "Lab orders and results." },
  { code: "RADIOLOGY", label: "Radiology", path: routes.radiology, icon: Activity, category: "Clinical", description: "Radiology orders and reports." },
  { code: "PHARMACY", label: "Pharmacy", path: routes.pharmacy, icon: Pill, category: "Clinical", description: "Prescriptions and dispensing." },
  { code: "DRUGS", label: "Drugs", path: routes.drugs, icon: Pill, category: "Administrative", description: "Drug formulary and categories." },
  { code: "ADMISSIONS", label: "Admissions", path: routes.admissions, icon: Bed, category: "Clinical", description: "Ward, bed, admission and discharge." },
  { code: "WARDS", label: "Wards", path: routes.wards, icon: Hospital, category: "Clinical", description: "Ward configuration and live bed occupancy." },
  { code: "BEDS", label: "Beds", path: routes.beds, icon: Bed, category: "Clinical", description: "Bed inventory across every ward." },
  { code: "MEDICATION_ADHERENCE", label: "Medication Adherence", path: routes.medicationAdherence, icon: Timer, category: "Clinical", description: "Dose schedules, alerts, refills and follow-ups." },

  // Financial
  { code: "BILLING", label: "Billing", path: routes.billing, icon: Receipt, category: "Financial", description: "Invoices, billing and charges." },
  { code: "PAYMENTS", label: "Payments", path: routes.payments, icon: CreditCard, category: "Financial", description: "Cash, transfer, gateway and membership card payments." },
  { code: "INSURANCE", label: "Insurance", path: routes.insurance, icon: ShieldCheck, category: "Financial", description: "Insurance claims and confirmations." },
  { code: "PAYROLL", label: "Payroll", path: routes.payroll, icon: Wallet, category: "Financial", description: "Payroll runs, lines and approvals." },
  { code: "TAX", label: "Tax", path: routes.tax, icon: Percent, category: "Financial", description: "Tax rates, rules, exemptions and reports." },

  // Administrative
  { code: "SERVICE_DELIVERY_POINTS", label: "Service Points", path: routes.serviceDeliveryPoints, icon: Building2, category: "Administrative", description: "Configure clinical service delivery points and queue prefixes." },
  { code: "INVENTORY", label: "Inventory", path: routes.inventoryStores, icon: Package, category: "Administrative", description: "Stores, stock, items and alerts." },
  { code: "APPOINTMENTS", label: "Appointments", path: routes.appointments, icon: Calendar, category: "Administrative", description: "Appointment scheduling and reminders." },
  { code: "DOCTOR_CALENDAR", label: "Doctor Calendar", path: routes.doctorCalendar, icon: UserRound, category: "Administrative", description: "Doctor slots, workload and time off." },
  { code: "STAFF", label: "Staff", path: routes.staff, icon: UserRound, category: "Administrative", description: "Hospital personnel management." },
  { code: "HR", label: "Human Resources", path: routes.hr, icon: Briefcase, category: "Administrative", description: "Staff profiles, onboarding, roster, attendance and leave." },

  { code: "APPROVALS", label: "Approvals", path: routes.approvals, icon: CheckSquare, category: "Administrative", description: "Approval flows and decisions." },
  { code: "REPORTS", label: "Reports", path: routes.reports, icon: BarChart3, category: "Administrative", description: "Operational and management reports." },

  // SaaS
  { code: "TENANTS", label: "Tenants", path: routes.tenants, icon: Globe, category: "SaaS", description: "SaaS Tenant management." },
  { code: "TENANT_MODULES", label: "Modules", path: routes.tenantModules, icon: Layers, category: "SaaS", description: "Module management." },
];

