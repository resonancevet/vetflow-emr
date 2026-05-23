"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, UserPlus, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const speciesOptions = [
  { value: "canine", label: "Canine" },
  { value: "feline", label: "Feline" },
  { value: "avian", label: "Avian" },
  { value: "rabbit", label: "Rabbit" },
  { value: "reptile", label: "Reptile" },
  { value: "equine", label: "Equine" },
  { value: "other", label: "Other" },
] as const;

const sexOptions = [
  { value: "male", label: "Male (Intact)" },
  { value: "female", label: "Female (Intact)" },
  { value: "male_neutered", label: "Male (Neutered)" },
  { value: "female_spayed", label: "Female (Spayed)" },
] as const;

export default function NewPatientPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    clientId: "",
    name: "",
    species: "canine" as string,
    breed: "",
    sex: "" as string,
    dob: "",
    color: "",
    microchipNumber: "",
  });
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showQuickAddClient, setShowQuickAddClient] = useState(false);

  const { data: clientResults } = trpc.clients.search.useQuery(
    { query: clientSearch },
    { enabled: clientSearch.length >= 1 }
  );

  const createPatient = trpc.patients.create.useMutation({
    onSuccess: () => {
      toast.success("Patient created");
      router.push("/patients");
    },
    onError: (err) => {
      toast.error(err.message);
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.clientId) {
      setError("Please select an owner (client).");
      return;
    }
    if (!form.name.trim()) {
      setError("Patient name is required.");
      return;
    }

    createPatient.mutate({
      clientId: form.clientId,
      name: form.name.trim(),
      species: form.species as any,
      breed: form.breed.trim() || undefined,
      sex: form.sex ? (form.sex as any) : undefined,
      dob: form.dob || undefined,
      color: form.color.trim() || undefined,
      microchipNumber: form.microchipNumber.trim() || undefined,
    });
  };

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const selectClient = (client: {
    id: string;
    firstName: string;
    lastName: string;
  }) => {
    setForm((prev) => ({ ...prev, clientId: client.id }));
    setSelectedClientName(`${client.firstName} ${client.lastName}`);
    setClientSearch("");
    setShowClientDropdown(false);
  };

  const noResults =
    clientSearch.length >= 1 &&
    clientResults !== undefined &&
    clientResults.length === 0;

  return (
    <div className="max-w-2xl">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/patients")}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Patients
      </Button>

      <h2 className="font-heading text-xl font-semibold">New Patient</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Add a new patient record
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {/* Client Search */}
        <div>
          <label className="text-sm font-medium">Owner (Client) *</label>
          {selectedClientName ? (
            <div className="mt-1 flex items-center gap-2">
              <div className="flex h-10 flex-1 items-center rounded-md border border-input bg-muted/50 px-3 text-sm">
                <Check className="mr-2 h-4 w-4 text-emerald-600" />
                {selectedClientName}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setForm((prev) => ({ ...prev, clientId: "" }));
                  setSelectedClientName("");
                }}
              >
                Change
              </Button>
            </div>
          ) : (
            <div className="relative mt-1">
              <Input
                placeholder="Search clients by name or email..."
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setShowClientDropdown(true);
                }}
                onFocus={() => setShowClientDropdown(true)}
                onBlur={() => {
                  // Delay to allow click on dropdown item
                  setTimeout(() => setShowClientDropdown(false), 200);
                }}
              />
              {showClientDropdown &&
                clientResults &&
                clientResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
                    {clientResults.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 first:rounded-t-md last:rounded-b-md"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectClient(client)}
                      >
                        <span className="font-medium">
                          {client.firstName} {client.lastName}
                        </span>
                        <span className="text-muted-foreground">
                          {client.email || client.phone || ""}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              {showClientDropdown && noResults && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card p-3 text-sm shadow-lg">
                  <p className="text-muted-foreground">
                    No clients match &ldquo;{clientSearch}&rdquo;.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2 w-full"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setShowQuickAddClient(true);
                      setShowClientDropdown(false);
                    }}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create new client
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium" htmlFor="name">
            Patient Name *
          </label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Patient name"
            className="mt-1"
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium" htmlFor="species">
              Species *
            </label>
            <select
              id="species"
              value={form.species}
              onChange={(e) => updateField("species", e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {speciesOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="breed">
              Breed
            </label>
            <Input
              id="breed"
              value={form.breed}
              onChange={(e) => updateField("breed", e.target.value)}
              placeholder="Breed"
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium" htmlFor="sex">
              Sex
            </label>
            <select
              id="sex"
              value={form.sex}
              onChange={(e) => updateField("sex", e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select sex...</option>
              {sexOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="dob">
              Date of Birth
            </label>
            <Input
              id="dob"
              type="date"
              value={form.dob}
              onChange={(e) => updateField("dob", e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium" htmlFor="color">
              Color/Markings
            </label>
            <Input
              id="color"
              value={form.color}
              onChange={(e) => updateField("color", e.target.value)}
              placeholder="e.g., Black and white"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="microchipNumber">
              Microchip Number
            </label>
            <Input
              id="microchipNumber"
              value={form.microchipNumber}
              onChange={(e) => updateField("microchipNumber", e.target.value)}
              placeholder="Microchip ID"
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="submit" disabled={createPatient.isPending}>
            {createPatient.isPending ? "Creating..." : "Create Patient"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/patients")}
          >
            Cancel
          </Button>
        </div>
      </form>

      {showQuickAddClient && (
        <QuickAddClientModal
          initialQuery={clientSearch}
          onClose={() => setShowQuickAddClient(false)}
          onCreated={(client) => {
            selectClient(client);
            setShowQuickAddClient(false);
          }}
        />
      )}
    </div>
  );
}

function splitName(query: string): { firstName: string; lastName: string } {
  const trimmed = query.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function QuickAddClientModal({
  initialQuery,
  onClose,
  onCreated,
}: {
  initialQuery: string;
  onClose: () => void;
  onCreated: (client: { id: string; firstName: string; lastName: string }) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const seed = splitName(initialQuery);
  const [firstName, setFirstName] = useState(seed.firstName);
  const [lastName, setLastName] = useState(seed.lastName);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const createClient = trpc.clients.create.useMutation({
    onSuccess: (client) => {
      toast.success("Client created");
      utils.clients.search.invalidate();
      utils.clients.list.invalidate();
      onCreated({
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
      });
    },
    onError: (err) => {
      setFormError(err.message);
    },
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onClick(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setFormError("First and last name are required.");
      return;
    }
    createClient.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-lg border border-border bg-card shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Create new client</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 px-4 py-3">
          {formError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              {formError}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                First name *
              </label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus
                required
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Last name *
              </label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Phone
            </label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Need address or notes? Use the full{" "}
            <a href="/clients/new" className="text-primary hover:underline">
              New Client form
            </a>{" "}
            instead.
          </p>
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={createClient.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={createClient.isPending}>
              {createClient.isPending ? "Creating..." : "Create & select"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
