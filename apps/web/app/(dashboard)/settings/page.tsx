"use client";

import { useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  Settings,
  Users,
  Calendar,
  DoorOpen,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  ShieldAlert,
  Database,
  Download,
  Upload,
  FileSpreadsheet,
  Check,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Types ───────────────────────────────────────────────────
type Tab = "practice" | "staff" | "appointmentTypes" | "rooms" | "data";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "practice", label: "Practice Info", icon: Settings },
  { id: "staff", label: "Staff", icon: Users },
  { id: "appointmentTypes", label: "Appointment Types", icon: Calendar },
  { id: "rooms", label: "Rooms", icon: DoorOpen },
  { id: "data", label: "Data", icon: Database },
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];

const PRESET_COLORS = [
  "#0d9488",
  "#dc2626",
  "#2563eb",
  "#7c3aed",
  "#ea580c",
  "#16a34a",
  "#f59e0b",
  "#6b7280",
];

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  veterinarian: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
  technician: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  front_desk: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const ROOM_TYPES = ["exam", "surgery", "treatment", "boarding"] as const;

// ── Main Page ───────────────────────────────────────────────
export default function SettingsPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("practice");

  if (session?.user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="font-heading text-xl font-semibold">Access Denied</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Only administrators can access practice settings.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold">Settings</h2>
          <p className="text-sm text-muted-foreground">
            Practice configuration and staff management
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 border-b border-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === "practice" && <PracticeInfoTab />}
        {activeTab === "staff" && <StaffTab />}
        {activeTab === "appointmentTypes" && <AppointmentTypesTab />}
        {activeTab === "rooms" && <RoomsTab />}
        {activeTab === "data" && <DataTab />}
      </div>
    </div>
  );
}

// ── Practice Info ───────────────────────────────────────────
function PracticeInfoTab() {
  const utils = trpc.useUtils();
  const { data: practice, isLoading } = trpc.settings.getPractice.useQuery();
  const updateMutation = trpc.settings.updatePractice.useMutation({
    onSuccess: () => {
      utils.settings.getPractice.invalidate();
      toast.success("Practice info updated");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [form, setForm] = useState<{
    name: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    timezone: string;
  } | null>(null);

  // Initialize form when data loads
  const current = form ?? {
    name: practice?.name ?? "",
    address: practice?.address ?? "",
    phone: practice?.phone ?? "",
    email: practice?.email ?? "",
    website: practice?.website ?? "",
    timezone: practice?.timezone ?? "America/New_York",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleChange = (field: string, value: string) => {
    setForm({ ...current, [field]: value });
  };

  return (
    <div className="max-w-2xl space-y-6 rounded-lg border border-border bg-card p-6">
      <div className="grid gap-4">
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Practice Name</span>
          <Input
            value={current.name}
            onChange={(e) => handleChange("name", e.target.value)}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Address</span>
          <Input
            value={current.address}
            onChange={(e) => handleChange("address", e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Phone</span>
            <Input
              value={current.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Email</span>
            <Input
              type="email"
              value={current.email}
              onChange={(e) => handleChange("email", e.target.value)}
            />
          </label>
        </div>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Website</span>
          <Input
            value={current.website}
            onChange={(e) => handleChange("website", e.target.value)}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Timezone</span>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={current.timezone}
            onChange={(e) => handleChange("timezone", e.target.value)}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Button
        onClick={() => {
          updateMutation.mutate(current);
        }}
        disabled={updateMutation.isPending}
      >
        {updateMutation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Save Changes
      </Button>
    </div>
  );
}

// ── Staff ───────────────────────────────────────────────────
function StaffTab() {
  const utils = trpc.useUtils();
  const { data: staffList, isLoading } = trpc.settings.listUsers.useQuery();
  const createMutation = trpc.settings.createUser.useMutation({
    onSuccess: () => {
      utils.settings.listUsers.invalidate();
      setShowAdd(false);
      resetAddForm();
      toast.success("Staff member added");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const updateMutation = trpc.settings.updateUser.useMutation({
    onSuccess: () => {
      utils.settings.listUsers.invalidate();
      setEditingId(null);
      toast.success("Staff member updated");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const deactivateMutation = trpc.settings.deactivateUser.useMutation({
    onSuccess: () => {
      utils.settings.listUsers.invalidate();
      toast.success("Staff member deactivated");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "front_desk" as const,
    phone: "",
    licenseNumber: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    role: "front_desk" as "admin" | "veterinarian" | "technician" | "front_desk",
    phone: "",
    licenseNumber: "",
  });
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null);

  const resetAddForm = () =>
    setAddForm({
      name: "",
      email: "",
      password: "",
      role: "front_desk",
      phone: "",
      licenseNumber: "",
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setShowAdd(!showAdd);
            resetAddForm();
          }}
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Staff
        </Button>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">New Staff Member</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Full name"
              value={addForm.name}
              onChange={(e) =>
                setAddForm({ ...addForm, name: e.target.value })
              }
            />
            <Input
              placeholder="Email"
              type="email"
              value={addForm.email}
              onChange={(e) =>
                setAddForm({ ...addForm, email: e.target.value })
              }
            />
            <Input
              placeholder="Password (min 6 chars)"
              type="password"
              value={addForm.password}
              onChange={(e) =>
                setAddForm({ ...addForm, password: e.target.value })
              }
            />
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={addForm.role}
              onChange={(e) =>
                setAddForm({
                  ...addForm,
                  role: e.target.value as typeof addForm.role,
                })
              }
            >
              <option value="front_desk">Front Desk</option>
              <option value="technician">Technician</option>
              <option value="veterinarian">Veterinarian</option>
              <option value="admin">Admin</option>
            </select>
            <Input
              placeholder="Phone (optional)"
              value={addForm.phone}
              onChange={(e) =>
                setAddForm({ ...addForm, phone: e.target.value })
              }
            />
            <Input
              placeholder="License # (optional)"
              value={addForm.licenseNumber}
              onChange={(e) =>
                setAddForm({ ...addForm, licenseNumber: e.target.value })
              }
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={
                !addForm.name ||
                !addForm.email ||
                addForm.password.length < 6 ||
                createMutation.isPending
              }
              onClick={() =>
                createMutation.mutate({
                  ...addForm,
                  phone: addForm.phone || undefined,
                  licenseNumber: addForm.licenseNumber || undefined,
                })
              }
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowAdd(false)}
            >
              Cancel
            </Button>
          </div>
          {createMutation.error && (
            <p className="text-sm text-destructive">
              {createMutation.error.message}
            </p>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Role</th>
              <th className="px-4 py-3 text-left font-medium">Phone</th>
              <th className="px-4 py-3 text-left font-medium">License #</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staffList?.map((user) => (
              <tr key={user.id} className="border-b border-border last:border-0">
                {editingId === user.id ? (
                  <>
                    <td className="px-4 py-2">
                      <Input
                        className="h-8"
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {user.email}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                        value={editForm.role}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            role: e.target.value as typeof editForm.role,
                          })
                        }
                      >
                        <option value="front_desk">Front Desk</option>
                        <option value="technician">Technician</option>
                        <option value="veterinarian">Veterinarian</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        className="h-8"
                        value={editForm.phone}
                        onChange={(e) =>
                          setEditForm({ ...editForm, phone: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        className="h-8"
                        value={editForm.licenseNumber}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            licenseNumber: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={updateMutation.isPending}
                          onClick={() =>
                            updateMutation.mutate({
                              id: user.id,
                              name: editForm.name,
                              role: editForm.role,
                              phone: editForm.phone || undefined,
                              licenseNumber:
                                editForm.licenseNumber || undefined,
                            })
                          }
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium">{user.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.email}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          ROLE_BADGE[user.role] ?? ROLE_BADGE.front_desk
                        )}
                      >
                        {user.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.phone ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.licenseNumber ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {confirmDeactivate === user.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="mr-2 text-xs text-destructive">
                            Deactivate?
                          </span>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deactivateMutation.isPending}
                            onClick={() => {
                              deactivateMutation.mutate({ id: user.id });
                              setConfirmDeactivate(null);
                            }}
                          >
                            Yes
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDeactivate(null)}
                          >
                            No
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(user.id);
                              setEditForm({
                                name: user.name,
                                role: user.role,
                                phone: user.phone ?? "",
                                licenseNumber: user.licenseNumber ?? "",
                              });
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDeactivate(user.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
            {staffList?.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No staff members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Appointment Types ───────────────────────────────────────
function AppointmentTypesTab() {
  const utils = trpc.useUtils();
  const { data: types, isLoading } =
    trpc.settings.listAppointmentTypes.useQuery();
  const createMutation = trpc.settings.createAppointmentType.useMutation({
    onSuccess: () => {
      utils.settings.listAppointmentTypes.invalidate();
      setShowAdd(false);
      resetAddForm();
      toast.success("Appointment type created");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const updateMutation = trpc.settings.updateAppointmentType.useMutation({
    onSuccess: () => {
      utils.settings.listAppointmentTypes.invalidate();
      setEditingId(null);
      toast.success("Appointment type updated");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const deleteMutation = trpc.settings.deleteAppointmentType.useMutation({
    onSuccess: () => {
      utils.settings.listAppointmentTypes.invalidate();
      toast.success("Appointment type deleted");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    durationMinutes: 30,
    color: "#0d9488",
    requiresDoctor: 1,
    defaultRoomType: "exam" as "exam" | "surgery" | "treatment" | "boarding",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...addForm });

  const resetAddForm = () =>
    setAddForm({
      name: "",
      durationMinutes: 30,
      color: "#0d9488",
      requiresDoctor: 1,
      defaultRoomType: "exam",
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setShowAdd(!showAdd);
            resetAddForm();
          }}
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Type
        </Button>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">New Appointment Type</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Type name"
              value={addForm.name}
              onChange={(e) =>
                setAddForm({ ...addForm, name: e.target.value })
              }
            />
            <Input
              type="number"
              placeholder="Duration (minutes)"
              value={addForm.durationMinutes}
              onChange={(e) =>
                setAddForm({
                  ...addForm,
                  durationMinutes: parseInt(e.target.value) || 30,
                })
              }
            />
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Color</span>
              <div className="flex gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-transform",
                      addForm.color === c
                        ? "border-foreground scale-110"
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setAddForm({ ...addForm, color: c })}
                  />
                ))}
              </div>
            </div>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={addForm.defaultRoomType}
              onChange={(e) =>
                setAddForm({
                  ...addForm,
                  defaultRoomType: e.target.value as typeof addForm.defaultRoomType,
                })
              }
            >
              {ROOM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!addForm.name || createMutation.isPending}
              onClick={() => createMutation.mutate(addForm)}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowAdd(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Duration</th>
              <th className="px-4 py-3 text-left font-medium">Color</th>
              <th className="px-4 py-3 text-left font-medium">Room Type</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {types?.map((type) => (
              <tr
                key={type.id}
                className="border-b border-border last:border-0"
              >
                {editingId === type.id ? (
                  <>
                    <td className="px-4 py-2">
                      <Input
                        className="h-8"
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        className="h-8 w-20"
                        type="number"
                        value={editForm.durationMinutes}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            durationMinutes: parseInt(e.target.value) || 30,
                          })
                        }
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            className={cn(
                              "h-6 w-6 rounded-full border-2",
                              editForm.color === c
                                ? "border-foreground"
                                : "border-transparent"
                            )}
                            style={{ backgroundColor: c }}
                            onClick={() =>
                              setEditForm({ ...editForm, color: c })
                            }
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                        value={editForm.defaultRoomType}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            defaultRoomType:
                              e.target.value as typeof editForm.defaultRoomType,
                          })
                        }
                      >
                        {ROOM_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={updateMutation.isPending}
                          onClick={() =>
                            updateMutation.mutate({
                              id: type.id,
                              ...editForm,
                            })
                          }
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium">{type.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {type.durationMinutes} min
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block h-4 w-4 rounded-full"
                        style={{ backgroundColor: type.color ?? "#6b7280" }}
                      />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">
                      {type.defaultRoomType ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(type.id);
                            setEditForm({
                              name: type.name,
                              durationMinutes: type.durationMinutes,
                              color: type.color ?? "#0d9488",
                              requiresDoctor: type.requiresDoctor,
                              defaultRoomType:
                                type.defaultRoomType ?? "exam",
                            });
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            deleteMutation.mutate({ id: type.id })
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {types?.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No appointment types configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── CSV Helpers ──────────────────────────────────────────────
function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = String(row[h] ?? "");
          return val.includes(",") || val.includes('"')
            ? `"${val.replace(/"/g, '""')}"`
            : val;
        })
        .join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

// ── Data Tab ─────────────────────────────────────────────────
function DataTab() {
  const [exportingType, setExportingType] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<"clients" | "patients" | null>(null);
  const [csvData, setCsvData] = useState<Record<string, string>[] | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number;
    errors?: string[];
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportClients = trpc.data.exportClients.useQuery(undefined, { enabled: false });
  const exportPatients = trpc.data.exportPatients.useQuery(undefined, { enabled: false });
  const exportAppointments = trpc.data.exportAppointments.useQuery(undefined, { enabled: false });
  const exportInvoices = trpc.data.exportInvoices.useQuery(undefined, { enabled: false });

  const importClientsMutation = trpc.data.importClients.useMutation({
    onSuccess: (data) => {
      setImportResult({ imported: data.imported });
      setCsvData(null);
      toast.success("Clients imported");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const importPatientsMutation = trpc.data.importPatients.useMutation({
    onSuccess: (data) => {
      setImportResult({ imported: data.imported, errors: data.errors });
      setCsvData(null);
      toast.success("Patients imported");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleExport = useCallback(
    async (type: "clients" | "patients" | "appointments" | "invoices") => {
      setExportingType(type);
      try {
        let data: Record<string, unknown>[] = [];
        if (type === "clients") {
          const result = await exportClients.refetch();
          data = (result.data ?? []) as Record<string, unknown>[];
        } else if (type === "patients") {
          const result = await exportPatients.refetch();
          data = (result.data ?? []) as Record<string, unknown>[];
        } else if (type === "appointments") {
          const result = await exportAppointments.refetch();
          data = (result.data ?? []) as Record<string, unknown>[];
        } else if (type === "invoices") {
          const result = await exportInvoices.refetch();
          // Flatten items for CSV
          const raw = result.data ?? [];
          data = raw.map((inv) => {
            const { items, ...rest } = inv;
            return {
              ...rest,
              items: items.map((i: { description: string }) => i.description).join("; "),
            } as Record<string, unknown>;
          });
        }
        downloadCSV(data, `${type}-export.csv`);
      } finally {
        setExportingType(null);
      }
    },
    [exportClients, exportPatients, exportAppointments, exportInvoices]
  );

  const handleFileSelect = useCallback(
    (file: File) => {
      setImportResult(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const parsed = parseCSV(text);
        setCsvData(parsed);
      };
      reader.readAsText(file);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith(".csv")) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleImportConfirm = useCallback(() => {
    if (!csvData || !importMode) return;
    if (importMode === "clients") {
      importClientsMutation.mutate({
        clients: csvData.map((row) => ({
          firstName: row.firstName || row.first_name || "",
          lastName: row.lastName || row.last_name || "",
          email: row.email || undefined,
          phone: row.phone || undefined,
          address: row.address || undefined,
          city: row.city || undefined,
          state: row.state || undefined,
          zip: row.zip || undefined,
        })),
      });
    } else {
      importPatientsMutation.mutate({
        patients: csvData.map((row) => ({
          clientEmail: row.clientEmail || row.client_email || "",
          name: row.name || "",
          species: (row.species as "canine" | "feline" | "avian" | "rabbit" | "reptile" | "equine" | "other") || "other",
          breed: row.breed || undefined,
          sex: (row.sex as "male" | "female" | "male_neutered" | "female_spayed") || undefined,
          dob: row.dob || undefined,
          color: row.color || undefined,
          microchipNumber: row.microchipNumber || row.microchip_number || undefined,
        })),
      });
    }
  }, [csvData, importMode, importClientsMutation, importPatientsMutation]);

  const isPending = importClientsMutation.isPending || importPatientsMutation.isPending;

  return (
    <div className="space-y-8">
      {/* Export Section */}
      <div>
        <h3 className="text-sm font-semibold mb-1">Export Data</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Download your practice data as CSV files.
        </p>
        <div className="grid grid-cols-2 gap-3 max-w-2xl">
          {(
            [
              { key: "clients", label: "Export Clients", icon: Users },
              { key: "patients", label: "Export Patients", icon: FileSpreadsheet },
              { key: "appointments", label: "Export Appointments", icon: Calendar },
              { key: "invoices", label: "Export Invoices", icon: FileSpreadsheet },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              variant="outline"
              className="justify-start gap-2"
              disabled={exportingType !== null}
              onClick={() => handleExport(key)}
            >
              {exportingType === key ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Import Section */}
      <div>
        <h3 className="text-sm font-semibold mb-1">Import Data</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Upload a CSV file to import clients or patients.
        </p>

        {/* Import mode selector */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={importMode === "clients" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setImportMode("clients");
              setCsvData(null);
              setImportResult(null);
            }}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import Clients
          </Button>
          <Button
            variant={importMode === "patients" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setImportMode("patients");
              setCsvData(null);
              setImportResult(null);
            }}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import Patients
          </Button>
        </div>

        {importMode && (
          <div className="max-w-2xl space-y-4">
            {/* Expected columns hint */}
            <p className="text-xs text-muted-foreground">
              {importMode === "clients"
                ? "Expected columns: firstName, lastName, email, phone, address, city, state, zip"
                : "Expected columns: clientEmail, name, species, breed, sex, dob, color, microchipNumber"}
            </p>

            {/* Drop zone */}
            <div
              className={cn(
                "rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Drag and drop a CSV file here, or click to select
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />
            </div>

            {/* Preview table */}
            {csvData && csvData.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  Preview ({csvData.length} rows total, showing first 5)
                </p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        {Object.keys(csvData[0]).map((header) => (
                          <th
                            key={header}
                            className="px-3 py-2 text-left font-medium whitespace-nowrap"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.slice(0, 5).map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-border last:border-0"
                        >
                          {Object.values(row).map((val, j) => (
                            <td
                              key={j}
                              className="px-3 py-2 text-muted-foreground whitespace-nowrap"
                            >
                              {val || "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={handleImportConfirm}
                  >
                    {isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    Confirm Import ({csvData.length} rows)
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCsvData(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Import result */}
            {importResult && (
              <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                  <Check className="h-4 w-4" />
                  {importResult.imported} records imported successfully
                </div>
                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-destructive">
                      {importResult.errors.length} error(s):
                    </p>
                    <ul className="text-xs text-destructive space-y-0.5">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Mutation error */}
            {(importClientsMutation.error || importPatientsMutation.error) && (
              <p className="text-sm text-destructive">
                {importClientsMutation.error?.message ??
                  importPatientsMutation.error?.message}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Rooms ───────────────────────────────────────────────────
function RoomsTab() {
  const utils = trpc.useUtils();
  const { data: roomList, isLoading } = trpc.settings.listRooms.useQuery();
  const createMutation = trpc.settings.createRoom.useMutation({
    onSuccess: () => {
      utils.settings.listRooms.invalidate();
      setShowAdd(false);
      setAddForm({ name: "", type: "exam" });
      toast.success("Room created");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
  const deleteMutation = trpc.settings.deleteRoom.useMutation({
    onSuccess: () => {
      utils.settings.listRooms.invalidate();
      toast.success("Room deleted");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    type: "exam" as "exam" | "surgery" | "treatment" | "boarding",
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => setShowAdd(!showAdd)}
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Room
        </Button>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">New Room</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Room name"
              value={addForm.name}
              onChange={(e) =>
                setAddForm({ ...addForm, name: e.target.value })
              }
            />
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={addForm.type}
              onChange={(e) =>
                setAddForm({
                  ...addForm,
                  type: e.target.value as typeof addForm.type,
                })
              }
            >
              {ROOM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!addForm.name || createMutation.isPending}
              onClick={() => createMutation.mutate(addForm)}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowAdd(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {roomList?.map((room) => (
              <tr
                key={room.id}
                className="border-b border-border last:border-0"
              >
                <td className="px-4 py-3 font-medium">{room.name}</td>
                <td className="px-4 py-3 text-muted-foreground capitalize">
                  {room.type}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate({ id: room.id })}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {roomList?.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No rooms configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
