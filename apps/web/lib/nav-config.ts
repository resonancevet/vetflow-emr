import {
  Calendar,
  FileText,
  PawPrint,
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
 * v0 field-vet navigation (back-office routes hidden, not deleted).
 * Mobile bottom nav surfaces only the four most common destinations to keep
 * tap targets large; Clients lives in the sidebar / drawer instead.
 */
export const v0NavItems: NavItem[] = [
  { href: "/schedule", label: "Schedule", icon: Calendar, mobilePrimary: true },
  { href: "/patients", label: "Patients", icon: PawPrint, mobilePrimary: true },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/records", label: "Records", icon: FileText, mobilePrimary: true },
  { href: "/settings", label: "Settings", icon: Settings, mobilePrimary: true },
];

export const routeLabels: Record<string, string> = {
  "/schedule": "Schedule",
  "/patients": "Patients",
  "/records": "Records",
  "/settings": "Settings",
  "/clients": "Clients",
};

export const v0NewActions = [
  { label: "New Patient", href: "/patients/new", icon: PawPrint },
  { label: "New Client", href: "/clients/new", icon: Users },
  { label: "New Appointment", href: "/schedule", icon: Calendar },
] as const;

export const DEMO_LOGIN = {
  email: "admin@neighborhoodvet.example.com",
  password: "password123",
} as const;

export const POST_LOGIN_PATH = "/schedule";
