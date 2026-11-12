"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  IntakeSignaturePad,
  type IntakeSignatureValue,
} from "@/components/portal/intake-signature";

type PetForm = {
  name: string;
  species: "canine" | "feline" | "avian" | "rabbit" | "reptile" | "equine" | "other";
  breed: string;
  color: string;
  sex: "" | "male" | "female" | "male_neutered" | "female_spayed";
  dob: string;
  ageAsOfToday: string;
  microchipNumber: string;
  vaccinationHistory: string;
  allergiesText: string;
  currentMedications: string;
  diet: string;
  previousVeterinarian: string;
  pastIllnessesSurgeries: string;
  behavioralConcerns: string;
};

const emptyPet = (): PetForm => ({
  name: "",
  species: "canine",
  breed: "",
  color: "",
  sex: "",
  dob: "",
  ageAsOfToday: "",
  microchipNumber: "",
  vaccinationHistory: "",
  allergiesText: "",
  currentMedications: "",
  diet: "",
  previousVeterinarian: "",
  pastIllnessesSurgeries: "",
  behavioralConcerns: "",
});

const STEPS = [
  "Your information",
  "Service agreement",
  "Media consent",
  "Pets",
  "Review",
] as const;

export default function IntakeWizardPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const inviteQuery = trpc.intake.getInvite.useQuery(
    { token },
    { retry: false }
  );

  const [step, setStep] = useState(0);
  const [clientForm, setClientForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    phoneSecondary: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    emergencyContact: "",
    emergencyPhone: "",
    preferredContactMethod: "email" as "phone" | "email" | "sms" | "portal",
  });
  const [prefilled, setPrefilled] = useState(false);
  const [agreementAgreed, setAgreementAgreed] = useState(false);
  const [agreementSig, setAgreementSig] = useState<IntakeSignatureValue | null>(
    null
  );
  const [mediaConsent, setMediaConsent] = useState<boolean | null>(null);
  const [mediaSig, setMediaSig] = useState<IntakeSignatureValue | null>(null);
  const [registrationSig, setRegistrationSig] =
    useState<IntakeSignatureValue | null>(null);
  const [pets, setPets] = useState<PetForm[]>([emptyPet()]);
  const [done, setDone] = useState<{ portalUrl: string } | null>(null);
  const [registrationAck, setRegistrationAck] = useState(false);

  useEffect(() => {
    if (!inviteQuery.data || prefilled) return;
    const c = inviteQuery.data.client;
    setPrefilled(true);
    setClientForm((f) => ({
      ...f,
      firstName: c.firstName || f.firstName,
      lastName: c.lastName || f.lastName,
      email: inviteQuery.data.email || c.email || f.email,
      phone: c.phone || f.phone,
      address: c.address || f.address,
      city: c.city || f.city,
      state: c.state || f.state,
      zip: c.zip || f.zip,
      emergencyContact: c.emergencyContact || f.emergencyContact,
      emergencyPhone: c.emergencyPhone || f.emergencyPhone,
      preferredContactMethod:
        (c.preferredContactMethod as typeof f.preferredContactMethod) ||
        f.preferredContactMethod,
    }));
  }, [inviteQuery.data, prefilled]);

  const submit = trpc.intake.submit.useMutation({
    onSuccess: (result) => {
      toast.success("Paperwork submitted — thank you!");
      setDone({ portalUrl: result.portalUrl });
    },
    onError: (err) => toast.error(err.message),
  });

  const agreement = inviteQuery.data?.agreement;

  const canNext = useMemo(() => {
    if (step === 0) {
      return (
        clientForm.firstName.trim() &&
        clientForm.lastName.trim() &&
        clientForm.email.trim()
      );
    }
    if (step === 1) {
      return agreementAgreed && Boolean(agreementSig);
    }
    if (step === 2) {
      return mediaConsent !== null && Boolean(mediaSig);
    }
    if (step === 3) {
      return pets.every((p) => p.name.trim() && p.species);
    }
    if (step === 4) {
      return registrationAck && Boolean(registrationSig);
    }
    return false;
  }, [
    step,
    clientForm,
    agreementAgreed,
    agreementSig,
    mediaConsent,
    mediaSig,
    pets,
    registrationAck,
    registrationSig,
  ]);

  const handleSubmit = () => {
    if (!agreementSig || !mediaSig || mediaConsent === null || !registrationSig) {
      toast.error("Please complete all required signatures");
      return;
    }
    submit.mutate({
      token,
      client: {
        ...clientForm,
        phone: clientForm.phone || undefined,
        phoneSecondary: clientForm.phoneSecondary || undefined,
        address: clientForm.address || undefined,
        city: clientForm.city || undefined,
        state: clientForm.state || undefined,
        zip: clientForm.zip || undefined,
        emergencyContact: clientForm.emergencyContact || undefined,
        emergencyPhone: clientForm.emergencyPhone || undefined,
      },
      mediaConsent,
      pets: pets.map((p) => ({
        name: p.name.trim(),
        species: p.species,
        breed: p.breed || undefined,
        color: p.color || undefined,
        sex: p.sex || undefined,
        dob: p.dob || undefined,
        ageAsOfToday: p.ageAsOfToday || undefined,
        microchipNumber: p.microchipNumber || undefined,
        vaccinationHistory: p.vaccinationHistory || undefined,
        allergiesText: p.allergiesText || undefined,
        currentMedications: p.currentMedications || undefined,
        diet: p.diet || undefined,
        previousVeterinarian: p.previousVeterinarian || undefined,
        pastIllnessesSurgeries: p.pastIllnessesSurgeries || undefined,
        behavioralConcerns: p.behavioralConcerns || undefined,
      })),
      signatures: [
        { section: "agreement" as const, ...agreementSig },
        { section: "media" as const, ...mediaSig },
        { section: "registration" as const, ...registrationSig },
      ],
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    });
  };

  if (inviteQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (inviteQuery.error) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <h1 className="text-lg font-semibold text-red-800">
          Unable to open intake form
        </h1>
        <p className="mt-2 text-sm text-red-700">{inviteQuery.error.message}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-emerald-200 bg-emerald-50 p-8 text-center">
        <h1 className="text-xl font-semibold text-emerald-900">
          Paperwork received
        </h1>
        <p className="mt-2 text-sm text-emerald-800">
          Thank you. Your information has been saved for{" "}
          {inviteQuery.data?.practiceName}.
        </p>
        <Button asChild className="mt-6">
          <Link href={done.portalUrl}>Open pet portal</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-gray-500">{inviteQuery.data?.practiceName}</p>
        <h1 className="text-2xl font-semibold text-gray-900">
          New client paperwork
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </p>
      </div>

      <div className="flex gap-1">
        {STEPS.map((_, i) => (
          <div
            key={STEPS[i]}
            className={`h-1.5 flex-1 rounded-full ${
              i <= step ? "bg-teal-600" : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">
            Only list adult clients (18+) who have full legal and financial
            authority for the pet(s).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name *">
              <Input
                value={clientForm.firstName}
                onChange={(e) =>
                  setClientForm((f) => ({ ...f, firstName: e.target.value }))
                }
              />
            </Field>
            <Field label="Last name *">
              <Input
                value={clientForm.lastName}
                onChange={(e) =>
                  setClientForm((f) => ({ ...f, lastName: e.target.value }))
                }
              />
            </Field>
          </div>
          <Field label="Email *">
            <Input
              type="email"
              value={clientForm.email}
              onChange={(e) =>
                setClientForm((f) => ({ ...f, email: e.target.value }))
              }
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Primary phone">
              <Input
                value={clientForm.phone}
                onChange={(e) =>
                  setClientForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </Field>
            <Field label="Secondary phone">
              <Input
                value={clientForm.phoneSecondary}
                onChange={(e) =>
                  setClientForm((f) => ({
                    ...f,
                    phoneSecondary: e.target.value,
                  }))
                }
              />
            </Field>
          </div>
          <Field label="Street address">
            <Input
              value={clientForm.address}
              onChange={(e) =>
                setClientForm((f) => ({ ...f, address: e.target.value }))
              }
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="City">
              <Input
                value={clientForm.city}
                onChange={(e) =>
                  setClientForm((f) => ({ ...f, city: e.target.value }))
                }
              />
            </Field>
            <Field label="State">
              <Input
                value={clientForm.state}
                onChange={(e) =>
                  setClientForm((f) => ({ ...f, state: e.target.value }))
                }
              />
            </Field>
            <Field label="ZIP">
              <Input
                value={clientForm.zip}
                onChange={(e) =>
                  setClientForm((f) => ({ ...f, zip: e.target.value }))
                }
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Emergency contact">
              <Input
                value={clientForm.emergencyContact}
                onChange={(e) =>
                  setClientForm((f) => ({
                    ...f,
                    emergencyContact: e.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Emergency phone">
              <Input
                value={clientForm.emergencyPhone}
                onChange={(e) =>
                  setClientForm((f) => ({
                    ...f,
                    emergencyPhone: e.target.value,
                  }))
                }
              />
            </Field>
          </div>
          <Field label="Preferred communication">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={clientForm.preferredContactMethod}
              onChange={(e) =>
                setClientForm((f) => ({
                  ...f,
                  preferredContactMethod: e.target
                    .value as typeof f.preferredContactMethod,
                }))
              }
            >
              <option value="phone">Phone</option>
              <option value="email">Email</option>
              <option value="sms">Text / SMS</option>
              <option value="portal">Pet portal</option>
            </select>
          </Field>
        </div>
      )}

      {step === 1 && agreement && (
        <div className="space-y-4">
          <div className="max-h-[28rem] space-y-4 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-semibold">{agreement.title}</h2>
            {agreement.sections.map((section) => (
              <div key={section.heading}>
                <h3 className="text-sm font-semibold text-gray-900">
                  {section.heading}
                </h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                  {section.body}
                </p>
              </div>
            ))}
          </div>
          <IntakeSignaturePad
            label="Sign the client agreement"
            value={agreementSig}
            onChange={setAgreementSig}
            requireAgreementCheckbox
            agreed={agreementAgreed}
            onAgreedChange={setAgreementAgreed}
            agreementLabel="I have read and agree to the Client Agreement and Consent to Treatment."
          />
        </div>
      )}

      {step === 2 && agreement && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-semibold">Consent to use of media</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
              {agreement.mediaConsentText}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="media"
                  checked={mediaConsent === true}
                  onChange={() => setMediaConsent(true)}
                />
                Yes, I agree to the Consent to Use of Media
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="media"
                  checked={mediaConsent === false}
                  onChange={() => setMediaConsent(false)}
                />
                No, I do not agree to the Consent to Use of Media
              </label>
            </div>
          </div>
          <IntakeSignaturePad
            label="Sign media consent choice"
            value={mediaSig}
            onChange={setMediaSig}
          />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          {pets.map((pet, index) => (
            <div
              key={index}
              className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Pet {index + 1}</h3>
                {pets.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setPets((list) => list.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Remove
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name *">
                  <Input
                    value={pet.name}
                    onChange={(e) =>
                      updatePet(setPets, index, { name: e.target.value })
                    }
                  />
                </Field>
                <Field label="Species *">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={pet.species}
                    onChange={(e) =>
                      updatePet(setPets, index, {
                        species: e.target.value as PetForm["species"],
                      })
                    }
                  >
                    <option value="canine">Dog</option>
                    <option value="feline">Cat</option>
                    <option value="avian">Bird</option>
                    <option value="rabbit">Rabbit</option>
                    <option value="reptile">Reptile</option>
                    <option value="equine">Horse</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="Breed">
                  <Input
                    value={pet.breed}
                    onChange={(e) =>
                      updatePet(setPets, index, { breed: e.target.value })
                    }
                  />
                </Field>
                <Field label="Color">
                  <Input
                    value={pet.color}
                    onChange={(e) =>
                      updatePet(setPets, index, { color: e.target.value })
                    }
                  />
                </Field>
                <Field label="Sex / reproductive status">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={pet.sex}
                    onChange={(e) =>
                      updatePet(setPets, index, {
                        sex: e.target.value as PetForm["sex"],
                      })
                    }
                  >
                    <option value="">Select…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="male_neutered">Male neutered</option>
                    <option value="female_spayed">Female spayed</option>
                  </select>
                </Field>
                <Field label="Date of birth">
                  <Input
                    type="date"
                    value={pet.dob}
                    onChange={(e) =>
                      updatePet(setPets, index, { dob: e.target.value })
                    }
                  />
                </Field>
                <Field label="Age as of today (if no DOB)">
                  <Input
                    value={pet.ageAsOfToday}
                    onChange={(e) =>
                      updatePet(setPets, index, {
                        ageAsOfToday: e.target.value,
                      })
                    }
                    placeholder="e.g. 4 years"
                  />
                </Field>
                <Field label="Microchip number">
                  <Input
                    value={pet.microchipNumber}
                    onChange={(e) =>
                      updatePet(setPets, index, {
                        microchipNumber: e.target.value,
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Vaccination history">
                <TextArea
                  value={pet.vaccinationHistory}
                  onChange={(v) =>
                    updatePet(setPets, index, { vaccinationHistory: v })
                  }
                />
              </Field>
              <Field label="Allergies / adverse reactions">
                <TextArea
                  value={pet.allergiesText}
                  onChange={(v) =>
                    updatePet(setPets, index, { allergiesText: v })
                  }
                />
              </Field>
              <Field label="Current medications / supplements">
                <TextArea
                  value={pet.currentMedications}
                  onChange={(v) =>
                    updatePet(setPets, index, { currentMedications: v })
                  }
                />
              </Field>
              <Field label="Diet">
                <TextArea
                  value={pet.diet}
                  onChange={(v) => updatePet(setPets, index, { diet: v })}
                />
              </Field>
              <Field label="Previous veterinarian / clinic">
                <Input
                  value={pet.previousVeterinarian}
                  onChange={(e) =>
                    updatePet(setPets, index, {
                      previousVeterinarian: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Past illnesses / surgeries">
                <TextArea
                  value={pet.pastIllnessesSurgeries}
                  onChange={(v) =>
                    updatePet(setPets, index, { pastIllnessesSurgeries: v })
                  }
                />
              </Field>
              <Field label="Behavioral concerns">
                <TextArea
                  value={pet.behavioralConcerns}
                  onChange={(v) =>
                    updatePet(setPets, index, { behavioralConcerns: v })
                  }
                />
              </Field>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => setPets((list) => [...list, emptyPet()])}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add another pet
          </Button>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
            <p>
              <span className="font-medium">Client:</span>{" "}
              {clientForm.firstName} {clientForm.lastName} · {clientForm.email}
            </p>
            <p className="mt-2">
              <span className="font-medium">Media consent:</span>{" "}
              {mediaConsent ? "Yes" : "No"}
            </p>
            <p className="mt-2 font-medium">Pets:</p>
            <ul className="mt-1 list-disc pl-5">
              {pets.map((p) => (
                <li key={p.name + p.species}>
                  {p.name} ({p.species}
                  {p.color ? `, ${p.color}` : ""})
                </li>
              ))}
            </ul>
          </div>
          <IntakeSignaturePad
            label="Confirm registration"
            value={registrationSig}
            onChange={setRegistrationSig}
            requireAgreementCheckbox
            agreed={registrationAck}
            onAgreedChange={setRegistrationAck}
            agreementLabel="I confirm the information above is accurate to the best of my knowledge."
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pb-8">
        <Button
          type="button"
          variant="outline"
          disabled={step === 0 || submit.isPending}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            disabled={!canNext}
            onClick={() => setStep((s) => s + 1)}
          >
            Continue
          </Button>
        ) : (
          <Button
            type="button"
            disabled={!canNext || submit.isPending}
            onClick={handleSubmit}
          >
            {submit.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit paperwork"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function TextArea({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function updatePet(
  setPets: React.Dispatch<React.SetStateAction<PetForm[]>>,
  index: number,
  patch: Partial<PetForm>
) {
  setPets((list) =>
    list.map((pet, i) => (i === index ? { ...pet, ...patch } : pet))
  );
}
