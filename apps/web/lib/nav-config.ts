import {
  Calendar,
  CloudDownload,
  MessageSquare,
  NotebookPen,
  PawPrint,
  RefreshCw,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export const APP_NAME = "VetRoamer";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in mobile bottom nav */
  mobilePrimary?: boolean;
};

/**
 * v0 field-vet navigation. Records was folded into the patient detail page,
 * so the four mobile bottom-nav slots are Schedule, Patients, Clients,
 * Settings.
 */
export const v0NavItems: NavItem[] = [
  { href: "/schedule", label: "Schedule", icon: Calendar, mobilePrimary: true },
  { href: "/patients", label: "Patients", icon: PawPrint, mobilePrimary: true },
  { href: "/clients", label: "Clients", icon: Users, mobilePrimary: true },
  { href: "/offline-notes", label: "Offline Notes", icon: NotebookPen },
  { href: "/offline-charts", label: "Offline Charts", icon: CloudDownload },
  { href: "/sync", label: "Pending Sync", icon: RefreshCw },
  { href: "/settings", label: "Settings", icon: Settings, mobilePrimary: true },
];

export const routeLabels: Record<string, string> = {
  "/schedule": "Schedule",
  "/patients": "Patients",
  "/settings": "Settings",
  "/clients": "Clients",
  "/communications": "Communications",
  "/offline-notes": "Offline Notes",
  "/offline-charts": "Offline Charts",
  "/sync": "Pending Sync",
};

export const v0NewActions = [
  { label: "New Patient", href: "/patients/new", icon: PawPrint },
  { label: "New Client", href: "/clients/new", icon: Users },
  { label: "New Appointment", href: "/schedule", icon: Calendar },
  { label: "Log Communication", href: "/communications/log", icon: MessageSquare },
  { label: "Offline Note", href: "/offline-notes", icon: NotebookPen },
] as const;

export const DEMO_LOGIN = {
  email: "admin@neighborhoodvet.example.com",
  password: "password123",
} as const;

export const POST_LOGIN_PATH = "/schedule";
