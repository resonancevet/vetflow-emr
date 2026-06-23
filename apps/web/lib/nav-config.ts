import {
  BarChart3,
  Calendar,
  Clipboard,
  DollarSign,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Package,
  PawPrint,
  Pill,
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
 * v0 navigation. Records was folded into the patient detail page, so the four
 * mobile bottom-nav slots are Schedule, Patients, Clients, Settings.
 */
export const v0NavItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/schedule", label: "Schedule", icon: Calendar, mobilePrimary: true },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/patients", label: "Patients", icon: PawPrint, mobilePrimary: true },
  { href: "/clients", label: "Clients", icon: Users, mobilePrimary: true },
  { href: "/whiteboard", label: "Whiteboard", icon: Clipboard },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/billing", label: "Billing", icon: DollarSign },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  {
    href: "/controlled-substances",
    label: "Controlled Substance Log",
    icon: Pill,
  },
  { href: "/settings", label: "Settings", icon: Settings, mobilePrimary: true },
];

export const routeLabels: Record<string, string> = {
  "/": "Dashboard",
  "/schedule": "Schedule",
  "/inbox": "Inbox",
  "/patients": "Patients",
  "/settings": "Settings",
  "/clients": "Clients",
  "/whiteboard": "Whiteboard",
  "/inventory": "Inventory",
  "/billing": "Billing",
  "/reports": "Reports",
  "/controlled-substances": "Controlled Substance Log",
  "/communications": "Communications",
};

export const v0NewActions = [
  { label: "New Patient", href: "/patients/new", icon: PawPrint },
  { label: "New Client", href: "/clients/new", icon: Users },
  { label: "New Appointment", href: "/schedule", icon: Calendar },
  { label: "Log Communication", href: "/communications/log", icon: MessageSquare },
] as const;

export const DEMO_LOGIN = {
  email: "admin@neighborhoodvet.example.com",
  password: "password123",
} as const;

export const POST_LOGIN_PATH = "/schedule";
