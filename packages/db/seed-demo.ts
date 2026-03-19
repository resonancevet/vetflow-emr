import { config } from "dotenv";
config({ path: "../../.env" });
import crypto from "crypto";
import { db } from "./client";
import {
  practices,
  locations,
  users,
  clients,
  patients,
  patientWeights,
  patientAllergies,
  appointmentTypes,
  rooms,
  appointments,
  soapNotes,
  vaccinationRecords,
  prescriptions,
  invoices,
  invoiceItems,
  services,
} from "./schema/index";

// ---------------------------------------------------------------------------
// Pre-hashed bcrypt value for "demo123"
// Generated with: bcryptjs.hashSync("demo123", 10)
// ---------------------------------------------------------------------------
const PASSWORD_HASH =
  "$2a$10$jBKNgwBVBAC/0kuXTDguY.9UmNdJs/zBO4C2uPl8IQhLwxAOjr4Ie";

// ---------------------------------------------------------------------------
// Helper: date math
// ---------------------------------------------------------------------------
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function setTime(d: Date, hours: number, minutes: number): Date {
  const copy = new Date(d);
  copy.setHours(hours, minutes, 0, 0);
  return copy;
}

function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60_000);
}

// ---------------------------------------------------------------------------
// Main demo seed function
// ---------------------------------------------------------------------------
async function seedDemo() {
  console.log("Seeding demo data for Pawsitive Care Veterinary Hospital...\n");

  // =========================================================================
  // 1. Practice
  // =========================================================================
  const [practice] = await db
    .insert(practices)
    .values({
      name: "Pawsitive Care Veterinary Hospital",
      address: "2150 Riverside Dr, Suite 100, Portland, OR 97201",
      phone: "(503) 555-7297",
      email: "hello@pawsitivecarevet.example.com",
      website: "https://pawsitivecarevet.example.com",
      timezone: "America/Los_Angeles",
      subscriptionTier: "professional",
    })
    .onConflictDoNothing()
    .returning();

  if (!practice) {
    console.log("Practice already exists or conflict detected. Exiting.");
    process.exit(0);
  }

  console.log(`Practice: ${practice.name} (${practice.id})`);
  const practiceId = practice.id;

  // =========================================================================
  // 2. Locations (main clinic + satellite)
  // =========================================================================
  const insertedLocations = await db
    .insert(locations)
    .values([
      {
        practiceId,
        name: "Main Clinic - Riverside",
        address: "2150 Riverside Dr, Suite 100, Portland, OR 97201",
        phone: "(503) 555-7297",
        isPrimary: true,
      },
      {
        practiceId,
        name: "Eastside Satellite Clinic",
        address: "840 SE Hawthorne Blvd, Portland, OR 97214",
        phone: "(503) 555-7298",
        isPrimary: false,
      },
    ])
    .returning();
  console.log(`Locations: ${insertedLocations.length} created`);
  const mainLocationId = insertedLocations[0]!.id;

  // =========================================================================
  // 3. Staff (4 users)
  // =========================================================================
  const staffData = [
    {
      email: "sarah.chen@pawsitivecarevet.example.com",
      name: "Dr. Sarah Chen",
      role: "admin" as const,
      licenseNumber: "VET-OR-44281",
      phone: "(503) 555-7297 x101",
    },
    {
      email: "james.rodriguez@pawsitivecarevet.example.com",
      name: "Dr. James Rodriguez",
      role: "veterinarian" as const,
      licenseNumber: "VET-OR-51903",
      phone: "(503) 555-7297 x102",
    },
    {
      email: "emily.chen@pawsitivecarevet.example.com",
      name: "Emily Chen",
      role: "technician" as const,
      licenseNumber: "LVT-OR-9201",
      phone: "(503) 555-7297 x201",
    },
    {
      email: "lisa.park@pawsitivecarevet.example.com",
      name: "Lisa Park",
      role: "front_desk" as const,
      licenseNumber: null,
      phone: "(503) 555-7297 x301",
    },
  ];

  const insertedUsers = await db
    .insert(users)
    .values(
      staffData.map((u) => ({
        ...u,
        passwordHash: PASSWORD_HASH,
        practiceId,
        locationId: mainLocationId,
      }))
    )
    .returning();
  console.log(`Users: ${insertedUsers.length} created`);

  const drMitchell = insertedUsers.find((u) => u.name === "Dr. Sarah Chen")!;
  const drRodriguez = insertedUsers.find((u) => u.name === "Dr. James Rodriguez")!;
  const emilyChen = insertedUsers.find((u) => u.name === "Emily Chen")!;
  const vets = [drMitchell, drRodriguez];

  // =========================================================================
  // 4. Clients (10)
  // =========================================================================
  const clientsData = [
    { firstName: "Olivia", lastName: "Bennett", address: "412 NW Everett St", city: "Portland", state: "OR", zip: "97209", phone: "(503) 555-2001", email: "olivia.bennett@example.com" },
    { firstName: "Marcus", lastName: "Johnson", address: "789 SE Division St", city: "Portland", state: "OR", zip: "97202", phone: "(503) 555-2002", email: "marcus.johnson@example.com" },
    { firstName: "Sarah", lastName: "Kim", address: "1020 NE Broadway", city: "Portland", state: "OR", zip: "97232", phone: "(503) 555-2003", email: "sarah.kim@example.com" },
    { firstName: "Daniel", lastName: "Okafor", address: "3344 SE Belmont St", city: "Portland", state: "OR", zip: "97214", phone: "(503) 555-2004", email: "daniel.okafor@example.com" },
    { firstName: "Rachel", lastName: "Vasquez", address: "567 NW 23rd Ave", city: "Portland", state: "OR", zip: "97210", phone: "(503) 555-2005", email: "rachel.vasquez@example.com" },
    { firstName: "Kevin", lastName: "Tanaka", address: "890 SE Hawthorne Blvd", city: "Portland", state: "OR", zip: "97214", phone: "(503) 555-2006", email: "kevin.tanaka@example.com" },
    { firstName: "Lauren", lastName: "McCarthy", address: "234 N Mississippi Ave", city: "Portland", state: "OR", zip: "97227", phone: "(503) 555-2007", email: "lauren.mccarthy@example.com" },
    { firstName: "David", lastName: "Nguyen", address: "1560 SE Ankeny St", city: "Portland", state: "OR", zip: "97214", phone: "(503) 555-2008", email: "david.nguyen@example.com" },
    { firstName: "Jessica", lastName: "Morales", address: "445 NE Alberta St", city: "Portland", state: "OR", zip: "97211", phone: "(503) 555-2009", email: "jessica.morales@example.com" },
    { firstName: "Brian", lastName: "Foster", address: "2280 SW 1st Ave", city: "Portland", state: "OR", zip: "97201", phone: "(503) 555-2010", email: "brian.foster@example.com" },
  ];

  const insertedClients = await db
    .insert(clients)
    .values(
      clientsData.map((c) => ({
        ...c,
        practiceId,
        preferredContactMethod: "email" as const,
        accessToken: crypto.randomUUID().replace(/-/g, ""),
      }))
    )
    .returning();
  console.log(`Clients: ${insertedClients.length} created`);

  // =========================================================================
  // 5. Patients (18) — dogs, cats, rabbits with realistic details
  // =========================================================================
  const patientsData: {
    clientIdx: number;
    name: string;
    species: "canine" | "feline" | "rabbit";
    breed: string;
    sex: "male" | "female" | "male_neutered" | "female_spayed";
    dob: string;
    color: string;
    weightKg: string;
    microchipNumber: string | null;
    photoUrl: string | null;
  }[] = [
    // Dogs (9)
    { clientIdx: 0, name: "Biscuit", species: "canine", breed: "Golden Retriever", sex: "male_neutered", dob: "2020-04-12", color: "Golden", weightKg: "32.5", microchipNumber: "985112006789012", photoUrl: "https://placedog.net/400/400?id=1" },
    { clientIdx: 1, name: "Zara", species: "canine", breed: "German Shepherd", sex: "female_spayed", dob: "2019-09-18", color: "Black and Tan", weightKg: "29.1", microchipNumber: "985112006789013", photoUrl: "https://placedog.net/400/400?id=2" },
    { clientIdx: 2, name: "Mochi", species: "canine", breed: "Shiba Inu", sex: "male_neutered", dob: "2021-06-05", color: "Red Sesame", weightKg: "10.2", microchipNumber: "985112006789014", photoUrl: "https://placedog.net/400/400?id=3" },
    { clientIdx: 3, name: "Luna", species: "canine", breed: "French Bulldog", sex: "female_spayed", dob: "2022-02-14", color: "Cream", weightKg: "11.8", microchipNumber: null, photoUrl: "https://placedog.net/400/400?id=4" },
    { clientIdx: 4, name: "Cooper", species: "canine", breed: "Labrador Retriever", sex: "male_neutered", dob: "2020-11-30", color: "Chocolate", weightKg: "34.0", microchipNumber: "985112006789016", photoUrl: null },
    { clientIdx: 5, name: "Rosie", species: "canine", breed: "Cavalier King Charles Spaniel", sex: "female_spayed", dob: "2021-08-20", color: "Blenheim", weightKg: "7.6", microchipNumber: null, photoUrl: "https://placedog.net/400/400?id=6" },
    { clientIdx: 6, name: "Bear", species: "canine", breed: "Bernese Mountain Dog", sex: "male", dob: "2022-01-10", color: "Tricolor", weightKg: "42.3", microchipNumber: "985112006789018", photoUrl: null },
    { clientIdx: 7, name: "Daisy", species: "canine", breed: "Beagle", sex: "female_spayed", dob: "2019-05-25", color: "Tricolor", weightKg: "11.0", microchipNumber: "985112006789019", photoUrl: "https://placedog.net/400/400?id=8" },
    { clientIdx: 0, name: "Peanut", species: "canine", breed: "Dachshund", sex: "male_neutered", dob: "2021-03-08", color: "Red", weightKg: "5.2", microchipNumber: null, photoUrl: null },
    // Cats (7)
    { clientIdx: 1, name: "Whiskers", species: "feline", breed: "Domestic Shorthair", sex: "male_neutered", dob: "2020-01-15", color: "Orange Tabby", weightKg: "5.1", microchipNumber: "985112006789020", photoUrl: "https://placekitten.com/400/400" },
    { clientIdx: 3, name: "Shadow", species: "feline", breed: "Russian Blue", sex: "male_neutered", dob: "2019-07-22", color: "Blue Gray", weightKg: "4.8", microchipNumber: null, photoUrl: null },
    { clientIdx: 5, name: "Cleo", species: "feline", breed: "Siamese", sex: "female_spayed", dob: "2021-04-10", color: "Seal Point", weightKg: "3.9", microchipNumber: "985112006789022", photoUrl: "https://placekitten.com/401/401" },
    { clientIdx: 7, name: "Oliver", species: "feline", breed: "Maine Coon", sex: "male", dob: "2022-09-01", color: "Brown Tabby", weightKg: "6.8", microchipNumber: null, photoUrl: null },
    { clientIdx: 8, name: "Nala", species: "feline", breed: "Bengal", sex: "female_spayed", dob: "2020-12-03", color: "Brown Spotted", weightKg: "4.5", microchipNumber: "985112006789024", photoUrl: "https://placekitten.com/402/402" },
    { clientIdx: 9, name: "Simba", species: "feline", breed: "Persian", sex: "male_neutered", dob: "2018-11-18", color: "White", weightKg: "5.3", microchipNumber: null, photoUrl: null },
    { clientIdx: 4, name: "Mittens", species: "feline", breed: "Ragdoll", sex: "female_spayed", dob: "2021-02-28", color: "Blue Bicolor", weightKg: "4.2", microchipNumber: "985112006789026", photoUrl: null },
    // Rabbits (2)
    { clientIdx: 8, name: "Thumper", species: "rabbit", breed: "Holland Lop", sex: "male_neutered", dob: "2023-03-15", color: "Tort", weightKg: "1.9", microchipNumber: null, photoUrl: null },
    { clientIdx: 9, name: "Clover", species: "rabbit", breed: "Mini Rex", sex: "female_spayed", dob: "2023-07-20", color: "Castor", weightKg: "1.6", microchipNumber: null, photoUrl: null },
  ];

  const insertedPatients = await db
    .insert(patients)
    .values(
      patientsData.map((p) => ({
        practiceId,
        clientId: insertedClients[p.clientIdx]!.id,
        name: p.name,
        species: p.species,
        breed: p.breed,
        sex: p.sex,
        dob: p.dob,
        color: p.color,
        microchipNumber: p.microchipNumber,
        photoUrl: p.photoUrl,
        status: "active" as const,
      }))
    )
    .returning();
  console.log(`Patients: ${insertedPatients.length} created`);

  // =========================================================================
  // 5b. Patient weights (3-4 entries over months for select patients)
  // =========================================================================
  const weightEntries: { patientId: string; weightKg: string; recordedAt: Date; recordedBy: string }[] = [];

  // Biscuit (Golden Retriever) - growing slightly
  const biscuit = insertedPatients[0]!;
  weightEntries.push(
    { patientId: biscuit.id, weightKg: "30.2", recordedAt: daysAgo(180), recordedBy: emilyChen.id },
    { patientId: biscuit.id, weightKg: "31.0", recordedAt: daysAgo(120), recordedBy: emilyChen.id },
    { patientId: biscuit.id, weightKg: "31.8", recordedAt: daysAgo(60), recordedBy: emilyChen.id },
    { patientId: biscuit.id, weightKg: "32.5", recordedAt: daysAgo(5), recordedBy: emilyChen.id },
  );

  // Luna (French Bulldog) - stable
  const luna = insertedPatients[3]!;
  weightEntries.push(
    { patientId: luna.id, weightKg: "11.5", recordedAt: daysAgo(150), recordedBy: emilyChen.id },
    { patientId: luna.id, weightKg: "11.6", recordedAt: daysAgo(90), recordedBy: emilyChen.id },
    { patientId: luna.id, weightKg: "11.8", recordedAt: daysAgo(14), recordedBy: emilyChen.id },
  );

  // Oliver (Maine Coon kitten) - growing
  const oliver = insertedPatients[12]!;
  weightEntries.push(
    { patientId: oliver.id, weightKg: "4.2", recordedAt: daysAgo(120), recordedBy: emilyChen.id },
    { patientId: oliver.id, weightKg: "5.1", recordedAt: daysAgo(80), recordedBy: emilyChen.id },
    { patientId: oliver.id, weightKg: "5.9", recordedAt: daysAgo(40), recordedBy: emilyChen.id },
    { patientId: oliver.id, weightKg: "6.8", recordedAt: daysAgo(3), recordedBy: emilyChen.id },
  );

  // Bear (Bernese) - large dog
  const bear = insertedPatients[6]!;
  weightEntries.push(
    { patientId: bear.id, weightKg: "40.1", recordedAt: daysAgo(90), recordedBy: emilyChen.id },
    { patientId: bear.id, weightKg: "41.5", recordedAt: daysAgo(45), recordedBy: emilyChen.id },
    { patientId: bear.id, weightKg: "42.3", recordedAt: daysAgo(7), recordedBy: emilyChen.id },
  );

  // Add a current-weight entry for remaining patients
  for (let i = 0; i < patientsData.length; i++) {
    const p = patientsData[i]!;
    const alreadyHasWeights = [0, 3, 6, 12].includes(i);
    if (!alreadyHasWeights) {
      weightEntries.push({
        patientId: insertedPatients[i]!.id,
        weightKg: p.weightKg,
        recordedAt: daysAgo(Math.floor(Math.random() * 30)),
        recordedBy: emilyChen.id,
      });
    }
  }

  await db.insert(patientWeights).values(weightEntries);
  console.log(`Patient weights: ${weightEntries.length} recorded`);

  // =========================================================================
  // 5c. Patient allergies
  // =========================================================================
  await db.insert(patientAllergies).values([
    { patientId: biscuit.id, allergen: "Penicillin", reaction: "Hives, facial swelling", severity: "severe" as const, notedBy: drMitchell.id },
    { patientId: luna.id, allergen: "Chicken protein", reaction: "GI upset, skin itching", severity: "moderate" as const, notedBy: drRodriguez.id },
    { patientId: insertedPatients[4]!.id, allergen: "Bee stings", reaction: "Localized swelling", severity: "mild" as const, notedBy: drMitchell.id },
    { patientId: insertedPatients[14]!.id, allergen: "Latex", reaction: "Contact dermatitis", severity: "mild" as const, notedBy: drRodriguez.id },
  ]);
  console.log("Patient allergies: 4 recorded");

  // =========================================================================
  // 6. Appointment Types
  // =========================================================================
  const apptTypesData = [
    { name: "Wellness Exam", durationMinutes: 30, color: "#0d9488", requiresDoctor: 1, defaultRoomType: "exam" as const },
    { name: "Sick Visit", durationMinutes: 30, color: "#dc2626", requiresDoctor: 1, defaultRoomType: "exam" as const },
    { name: "Surgery", durationMinutes: 60, color: "#7c3aed", requiresDoctor: 1, defaultRoomType: "surgery" as const },
    { name: "Dental Cleaning", durationMinutes: 45, color: "#ea580c", requiresDoctor: 1, defaultRoomType: "exam" as const },
    { name: "Vaccination", durationMinutes: 15, color: "#2563eb", requiresDoctor: 1, defaultRoomType: "exam" as const },
    { name: "Emergency", durationMinutes: 60, color: "#be123c", requiresDoctor: 1, defaultRoomType: "treatment" as const },
  ];

  const insertedApptTypes = await db
    .insert(appointmentTypes)
    .values(apptTypesData.map((t) => ({ ...t, practiceId })))
    .returning();
  console.log(`Appointment types: ${insertedApptTypes.length} created`);

  // =========================================================================
  // 7. Rooms
  // =========================================================================
  const insertedRooms = await db
    .insert(rooms)
    .values([
      { practiceId, locationId: mainLocationId, name: "Exam 1", type: "exam" as const },
      { practiceId, locationId: mainLocationId, name: "Exam 2", type: "exam" as const },
      { practiceId, locationId: mainLocationId, name: "Surgery Suite", type: "surgery" as const },
      { practiceId, locationId: mainLocationId, name: "Treatment Area", type: "treatment" as const },
    ])
    .returning();
  console.log(`Rooms: ${insertedRooms.length} created`);

  // =========================================================================
  // 8. Services (10)
  // =========================================================================
  const servicesData = [
    { name: "Office Exam", code: "EXAM-01", category: "Exam", defaultPrice: "65.00" },
    { name: "Vaccination Administration", code: "VAX-01", category: "Vaccine", defaultPrice: "28.00" },
    { name: "Spay (Ovariohysterectomy)", code: "SURG-01", category: "Surgery", defaultPrice: "420.00" },
    { name: "Neuter (Orchiectomy)", code: "SURG-02", category: "Surgery", defaultPrice: "310.00" },
    { name: "Dental Prophylaxis", code: "DENT-01", category: "Dental", defaultPrice: "365.00" },
    { name: "CBC/Chemistry Panel", code: "LAB-01", category: "Lab", defaultPrice: "148.00" },
    { name: "Radiograph (2 views)", code: "DIAG-01", category: "Diagnostic", defaultPrice: "190.00" },
    { name: "Nail Trim", code: "GROO-01", category: "Grooming", defaultPrice: "18.00" },
    { name: "Microchip Implantation", code: "MISC-01", category: "Misc", defaultPrice: "55.00" },
    { name: "Fecal Float Test", code: "LAB-02", category: "Lab", defaultPrice: "38.00" },
  ];

  const insertedServices = await db
    .insert(services)
    .values(servicesData.map((s) => ({ ...s, practiceId, taxable: true })))
    .returning();
  console.log(`Services: ${insertedServices.length} created`);

  // =========================================================================
  // 9. Appointments (20) — mix of today/this week/past
  // =========================================================================
  const today = new Date();
  const examRooms = insertedRooms.filter((r) => r.type === "exam");
  const wellnessType = insertedApptTypes.find((t) => t.name === "Wellness Exam")!;
  const sickType = insertedApptTypes.find((t) => t.name === "Sick Visit")!;
  const surgeryType = insertedApptTypes.find((t) => t.name === "Surgery")!;
  const dentalType = insertedApptTypes.find((t) => t.name === "Dental Cleaning")!;
  const vaxType = insertedApptTypes.find((t) => t.name === "Vaccination")!;
  const emergType = insertedApptTypes.find((t) => t.name === "Emergency")!;

  const appointmentValues: {
    practiceId: string;
    startTime: Date;
    endTime: Date;
    typeId: string;
    patientId: string;
    clientId: string;
    doctorId: string;
    roomId: string;
    status: "scheduled" | "confirmed" | "checked_in" | "in_exam" | "checked_out" | "no_show" | "cancelled";
    notes: string | null;
  }[] = [
    // Past appointments (8) - all checked_out
    { practiceId, startTime: setTime(daysAgo(14), 9, 0), endTime: setTime(daysAgo(14), 9, 30), typeId: wellnessType.id, patientId: biscuit.id, clientId: insertedClients[0]!.id, doctorId: drMitchell.id, roomId: examRooms[0]!.id, status: "checked_out", notes: "Annual wellness exam" },
    { practiceId, startTime: setTime(daysAgo(12), 10, 0), endTime: setTime(daysAgo(12), 10, 30), typeId: sickType.id, patientId: insertedPatients[1]!.id, clientId: insertedClients[1]!.id, doctorId: drRodriguez.id, roomId: examRooms[1]!.id, status: "checked_out", notes: "Decreased appetite, lethargy" },
    { practiceId, startTime: setTime(daysAgo(10), 14, 0), endTime: setTime(daysAgo(10), 15, 0), typeId: surgeryType.id, patientId: insertedPatients[6]!.id, clientId: insertedClients[6]!.id, doctorId: drMitchell.id, roomId: insertedRooms.find((r) => r.type === "surgery")!.id, status: "checked_out", notes: "Neuter procedure" },
    { practiceId, startTime: setTime(daysAgo(8), 11, 0), endTime: setTime(daysAgo(8), 11, 15), typeId: vaxType.id, patientId: insertedPatients[4]!.id, clientId: insertedClients[4]!.id, doctorId: drRodriguez.id, roomId: examRooms[0]!.id, status: "checked_out", notes: "DHPP booster" },
    { practiceId, startTime: setTime(daysAgo(7), 9, 30), endTime: setTime(daysAgo(7), 10, 15), typeId: dentalType.id, patientId: insertedPatients[7]!.id, clientId: insertedClients[7]!.id, doctorId: drMitchell.id, roomId: examRooms[1]!.id, status: "checked_out", notes: "Grade 2 dental disease, prophylaxis performed" },
    { practiceId, startTime: setTime(daysAgo(5), 13, 0), endTime: setTime(daysAgo(5), 13, 30), typeId: wellnessType.id, patientId: insertedPatients[9]!.id, clientId: insertedClients[1]!.id, doctorId: drRodriguez.id, roomId: examRooms[0]!.id, status: "checked_out", notes: "Annual exam for Whiskers" },
    { practiceId, startTime: setTime(daysAgo(3), 15, 0), endTime: setTime(daysAgo(3), 16, 0), typeId: emergType.id, patientId: luna.id, clientId: insertedClients[3]!.id, doctorId: drMitchell.id, roomId: insertedRooms.find((r) => r.type === "treatment")!.id, status: "checked_out", notes: "Acute vomiting, foreign body suspected" },
    { practiceId, startTime: setTime(daysAgo(2), 10, 30), endTime: setTime(daysAgo(2), 11, 0), typeId: sickType.id, patientId: insertedPatients[11]!.id, clientId: insertedClients[5]!.id, doctorId: drRodriguez.id, roomId: examRooms[1]!.id, status: "checked_out", notes: "Upper respiratory symptoms" },
    // No-show and cancelled (2)
    { practiceId, startTime: setTime(daysAgo(6), 14, 0), endTime: setTime(daysAgo(6), 14, 30), typeId: wellnessType.id, patientId: insertedPatients[5]!.id, clientId: insertedClients[5]!.id, doctorId: drMitchell.id, roomId: examRooms[0]!.id, status: "no_show", notes: null },
    { practiceId, startTime: setTime(daysAgo(4), 11, 0), endTime: setTime(daysAgo(4), 11, 30), typeId: sickType.id, patientId: insertedPatients[2]!.id, clientId: insertedClients[2]!.id, doctorId: drRodriguez.id, roomId: examRooms[1]!.id, status: "cancelled", notes: "Client called to reschedule" },
    // Today's appointments (5)
    { practiceId, startTime: setTime(today, 9, 0), endTime: setTime(today, 9, 30), typeId: wellnessType.id, patientId: insertedPatients[2]!.id, clientId: insertedClients[2]!.id, doctorId: drMitchell.id, roomId: examRooms[0]!.id, status: "checked_out", notes: "Mochi annual checkup" },
    { practiceId, startTime: setTime(today, 9, 30), endTime: setTime(today, 10, 0), typeId: vaxType.id, patientId: insertedPatients[13]!.id, clientId: insertedClients[7]!.id, doctorId: drRodriguez.id, roomId: examRooms[1]!.id, status: "in_exam", notes: "FVRCP booster due" },
    { practiceId, startTime: setTime(today, 10, 30), endTime: setTime(today, 11, 0), typeId: sickType.id, patientId: insertedPatients[8]!.id, clientId: insertedClients[0]!.id, doctorId: drMitchell.id, roomId: examRooms[0]!.id, status: "checked_in", notes: "Limping on right forelimb" },
    { practiceId, startTime: setTime(today, 14, 0), endTime: setTime(today, 14, 30), typeId: wellnessType.id, patientId: insertedPatients[16]!.id, clientId: insertedClients[4]!.id, doctorId: drRodriguez.id, roomId: examRooms[1]!.id, status: "confirmed", notes: null },
    { practiceId, startTime: setTime(today, 15, 0), endTime: setTime(today, 15, 15), typeId: vaxType.id, patientId: insertedPatients[17]!.id, clientId: insertedClients[8]!.id, doctorId: drMitchell.id, roomId: examRooms[0]!.id, status: "scheduled", notes: "RHDV2 vaccine" },
    // Future appointments (5)
    { practiceId, startTime: setTime(daysFromNow(1), 9, 0), endTime: setTime(daysFromNow(1), 9, 45), typeId: dentalType.id, patientId: insertedPatients[15]!.id, clientId: insertedClients[9]!.id, doctorId: drRodriguez.id, roomId: examRooms[0]!.id, status: "confirmed", notes: "Dental cleaning, pre-anesthetic bloodwork completed" },
    { practiceId, startTime: setTime(daysFromNow(2), 10, 0), endTime: setTime(daysFromNow(2), 11, 0), typeId: surgeryType.id, patientId: insertedPatients[12]!.id, clientId: insertedClients[7]!.id, doctorId: drMitchell.id, roomId: insertedRooms.find((r) => r.type === "surgery")!.id, status: "confirmed", notes: "Neuter" },
    { practiceId, startTime: setTime(daysFromNow(3), 14, 0), endTime: setTime(daysFromNow(3), 14, 30), typeId: wellnessType.id, patientId: insertedPatients[10]!.id, clientId: insertedClients[3]!.id, doctorId: drRodriguez.id, roomId: examRooms[1]!.id, status: "scheduled", notes: null },
    { practiceId, startTime: setTime(daysFromNow(5), 9, 30), endTime: setTime(daysFromNow(5), 10, 0), typeId: sickType.id, patientId: insertedPatients[5]!.id, clientId: insertedClients[5]!.id, doctorId: drMitchell.id, roomId: examRooms[0]!.id, status: "scheduled", notes: "Follow-up on skin issue" },
    { practiceId, startTime: setTime(daysFromNow(7), 11, 0), endTime: setTime(daysFromNow(7), 11, 15), typeId: vaxType.id, patientId: insertedPatients[14]!.id, clientId: insertedClients[9]!.id, doctorId: drRodriguez.id, roomId: examRooms[1]!.id, status: "scheduled", notes: "Rabies vaccine due" },
  ];

  const insertedAppointments = await db
    .insert(appointments)
    .values(appointmentValues)
    .returning();
  console.log(`Appointments: ${insertedAppointments.length} created`);

  // =========================================================================
  // 10. SOAP Notes (5) for past checked-out appointments
  // =========================================================================
  const pastCheckedOut = insertedAppointments.filter((a) => a.status === "checked_out");

  const soapData = [
    {
      subjective: "Owner reports Biscuit has been eating and drinking normally. No vomiting or diarrhea. Activity level remains high. Currently on Heartgard Plus and NexGard monthly. Owner asks about switching to a joint supplement as Biscuit is getting older.",
      objective: "T: 101.3F, HR: 82bpm, RR: 18. BCS: 5/9. Bright, alert, responsive. Coat glossy and well-maintained. Mild tartar on upper premolars. Heart and lungs auscultate normally. Abdomen soft, non-painful. All lymph nodes within normal limits. Bilateral stifles stable.",
      assessment: "Healthy adult Golden Retriever. Mild dental tartar buildup - recommend dental prophylaxis within 6 months. Good overall body condition.",
      plan: "Continue current diet (Hill's Science Diet Adult). Start Dasuquin joint supplement. Schedule dental cleaning in 4-6 months. Update DHPP and Rabies vaccines today. Recheck in 1 year or as needed. Discussed dental home care options with owner.",
    },
    {
      subjective: "Zara has had decreased appetite for 3 days per owner. Seems lethargic. No vomiting but softer stools than usual. Still drinking water. Was at dog park 4 days ago. On regular diet (Royal Canin GSD formula).",
      objective: "T: 103.1F, HR: 115bpm, RR: 26. BCS: 4/9. Mild dehydration (skin turgor slightly prolonged). Abdomen moderately tense on palpation, mild discomfort in cranial quadrant. No masses palpated. Mucous membranes pink, CRT < 2 sec.",
      assessment: "Suspected gastroenteritis, likely dietary indiscretion at dog park. DDx: pancreatitis, foreign body, infectious gastroenteritis. Mild fever supports inflammatory/infectious process.",
      plan: "CBC/Chem panel submitted - pending results. SQ fluids 200mL administered. Cerenia 1mg/kg SQ given. Bland diet (boiled chicken and rice) for 5 days. Recheck in 48 hours if not improving. ER if vomiting begins or lethargy worsens. Call with lab results tomorrow.",
    },
    {
      subjective: "Annual vaccination visit for Cooper. Owner reports no concerns. Patient on monthly Simparica Trio. Eating well, active, no behavioral changes.",
      objective: "T: 100.9F, HR: 88bpm, RR: 16. BCS: 6/9 - slightly overweight. All systems within normal limits. Heart and lungs clear. Teeth clean, minimal tartar. Ears clean bilaterally. Good muscle tone.",
      assessment: "Healthy patient, mildly overweight at 34.0 kg (ideal range 29-32 kg for breed). Vaccines updated today.",
      plan: "Administered DHPP and Bordetella vaccines. Rabies current (due next year). Recommend reducing daily food intake by 15% and adding a 20-minute walk. Weight recheck in 3 months to assess progress. Next annual due in 12 months.",
    },
    {
      subjective: "Daisy presented for dental cleaning. Pre-anesthetic bloodwork from last week was within normal limits. NPO since 10pm last night. Owner concerned about bad breath that has worsened over past 2 months.",
      objective: "Pre-anesthetic: T: 101.0F, HR: 90bpm, RR: 14. ASA Class I. Oral exam under sedation reveals Grade 2 dental disease. Heavy tartar on P3-P4 and M1 bilaterally. Mild gingivitis along upper arcade. Full-mouth radiographs: no root pathology identified.",
      assessment: "Grade 2 periodontal disease with significant tartar accumulation. All teeth structurally sound on radiographs. No extractions required.",
      plan: "Full dental prophylaxis performed under general anesthesia (propofol IV induction, isoflurane maintenance). Ultrasonic scaling, hand scaling of subgingival areas, polishing, fluoride treatment. Recovery uneventful - extubated at 25 min. Discharge this evening with soft food for 3 days. Recommend daily dental chews and brushing 3x/week.",
    },
    {
      subjective: "Whiskers here for annual wellness exam. Owner notes he has been more vocal than usual but otherwise normal behavior. Indoor-only cat. On Royal Canin Indoor Adult. No changes in litter box habits.",
      objective: "T: 101.5F, HR: 180bpm, RR: 24. BCS: 6/9. Mild dental tartar. Coat in good condition. Heart: no murmur detected. Lungs clear. Abdomen: soft, non-painful, kidneys symmetric. No palpable thyroid nodule. Weight stable from last visit.",
      assessment: "Healthy adult DSH. Slightly overweight. Increased vocalization may be behavioral - discuss enrichment. Vaccines due for FVRCP booster.",
      plan: "FVRCP booster administered. Recommend weight management - transition to Royal Canin Weight Care over 2 weeks. Add interactive feeding toys for enrichment. Consider Feliway diffuser if vocalization persists. Recheck in 1 year.",
    },
  ];

  const soapNotesToInsert = pastCheckedOut.slice(0, 5).map((appt, i) => ({
    practiceId,
    patientId: appt.patientId!,
    appointmentId: appt.id,
    authorId: appt.doctorId!,
    subjective: soapData[i]!.subjective,
    objective: soapData[i]!.objective,
    assessment: soapData[i]!.assessment,
    plan: soapData[i]!.plan,
  }));

  await db.insert(soapNotes).values(soapNotesToInsert);
  console.log(`SOAP notes: ${soapNotesToInsert.length} created`);

  // =========================================================================
  // 11. Vaccination Records (10)
  // =========================================================================
  const vaccinationValues: {
    practiceId: string;
    patientId: string;
    vaccineName: string;
    lotNumber: string;
    manufacturer: string;
    administeredBy: string;
    administeredAt: Date;
    nextDueDate: string;
  }[] = [
    // Dogs
    { practiceId, patientId: biscuit.id, vaccineName: "DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)", lotNumber: "LOT-A8F2K1", manufacturer: "Zoetis", administeredBy: drMitchell.id, administeredAt: daysAgo(14), nextDueDate: dateStr(daysFromNow(351)) },
    { practiceId, patientId: biscuit.id, vaccineName: "Rabies (3-year)", lotNumber: "LOT-R3Y9B2", manufacturer: "Boehringer Ingelheim", administeredBy: drMitchell.id, administeredAt: daysAgo(180), nextDueDate: dateStr(daysFromNow(915)) },
    { practiceId, patientId: insertedPatients[1]!.id, vaccineName: "Bordetella", lotNumber: "LOT-B4C7D3", manufacturer: "Zoetis", administeredBy: drRodriguez.id, administeredAt: daysAgo(90), nextDueDate: dateStr(daysFromNow(275)) },
    { practiceId, patientId: insertedPatients[4]!.id, vaccineName: "DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)", lotNumber: "LOT-A8F2K4", manufacturer: "Zoetis", administeredBy: drRodriguez.id, administeredAt: daysAgo(8), nextDueDate: dateStr(daysFromNow(357)) },
    { practiceId, patientId: insertedPatients[4]!.id, vaccineName: "Rabies (3-year)", lotNumber: "LOT-R3Y9B5", manufacturer: "Boehringer Ingelheim", administeredBy: drRodriguez.id, administeredAt: daysAgo(200), nextDueDate: dateStr(daysFromNow(895)) },
    // Cats
    { practiceId, patientId: insertedPatients[9]!.id, vaccineName: "FVRCP (Feline Viral Rhinotracheitis/Calicivirus/Panleukopenia)", lotNumber: "LOT-F1V3R6", manufacturer: "Boehringer Ingelheim", administeredBy: drRodriguez.id, administeredAt: daysAgo(5), nextDueDate: dateStr(daysFromNow(360)) },
    { practiceId, patientId: insertedPatients[9]!.id, vaccineName: "Rabies (1-year, feline)", lotNumber: "LOT-R1Y4C7", manufacturer: "Boehringer Ingelheim", administeredBy: drRodriguez.id, administeredAt: daysAgo(120), nextDueDate: dateStr(daysFromNow(245)) },
    { practiceId, patientId: insertedPatients[11]!.id, vaccineName: "FVRCP (Feline Viral Rhinotracheitis/Calicivirus/Panleukopenia)", lotNumber: "LOT-F1V3R8", manufacturer: "Boehringer Ingelheim", administeredBy: drMitchell.id, administeredAt: daysAgo(60), nextDueDate: dateStr(daysFromNow(305)) },
    { practiceId, patientId: insertedPatients[14]!.id, vaccineName: "FeLV (Feline Leukemia)", lotNumber: "LOT-L2E5V9", manufacturer: "Boehringer Ingelheim", administeredBy: drMitchell.id, administeredAt: daysAgo(45), nextDueDate: dateStr(daysFromNow(320)) },
    // Rabbit
    { practiceId, patientId: insertedPatients[17]!.id, vaccineName: "RHDV2 (Rabbit Hemorrhagic Disease)", lotNumber: "LOT-H2D1V0", manufacturer: "Medgene", administeredBy: drRodriguez.id, administeredAt: daysAgo(30), nextDueDate: dateStr(daysFromNow(335)) },
  ];

  await db.insert(vaccinationRecords).values(vaccinationValues);
  console.log(`Vaccination records: ${vaccinationValues.length} created`);

  // =========================================================================
  // 12. Invoices (8) — mix of paid/sent/draft
  // =========================================================================
  const examService = insertedServices.find((s) => s.code === "EXAM-01")!;
  const vaxService = insertedServices.find((s) => s.code === "VAX-01")!;
  const spayService = insertedServices.find((s) => s.code === "SURG-01")!;
  const dentalService = insertedServices.find((s) => s.code === "DENT-01")!;
  const labService = insertedServices.find((s) => s.code === "LAB-01")!;
  const nailService = insertedServices.find((s) => s.code === "GROO-01")!;
  const fecalService = insertedServices.find((s) => s.code === "LAB-02")!;
  const microchipService = insertedServices.find((s) => s.code === "MISC-01")!;

  // Build invoices with specific items
  const invoiceRecords: {
    practiceId: string;
    clientId: string;
    patientId: string;
    appointmentId: string | null;
    status: "draft" | "sent" | "paid" | "overdue";
    subtotal: string;
    tax: string;
    total: string;
    paidAmount: string;
    dueDate: string;
    items: { description: string; quantity: number; unitPrice: string; total: string; itemType: "service" | "product" }[];
  }[] = [
    // Paid invoices (4)
    {
      practiceId, clientId: insertedClients[0]!.id, patientId: biscuit.id, appointmentId: insertedAppointments[0]!.id,
      status: "paid", subtotal: "121.00", tax: "9.68", total: "130.68", paidAmount: "130.68", dueDate: dateStr(daysAgo(7)),
      items: [
        { description: "Office Exam", quantity: 1, unitPrice: "65.00", total: "65.00", itemType: "service" },
        { description: "Vaccination Administration", quantity: 2, unitPrice: "28.00", total: "56.00", itemType: "service" },
      ],
    },
    {
      practiceId, clientId: insertedClients[1]!.id, patientId: insertedPatients[1]!.id, appointmentId: insertedAppointments[1]!.id,
      status: "paid", subtotal: "213.00", tax: "17.04", total: "230.04", paidAmount: "230.04", dueDate: dateStr(daysAgo(5)),
      items: [
        { description: "Office Exam", quantity: 1, unitPrice: "65.00", total: "65.00", itemType: "service" },
        { description: "CBC/Chemistry Panel", quantity: 1, unitPrice: "148.00", total: "148.00", itemType: "service" },
      ],
    },
    {
      practiceId, clientId: insertedClients[4]!.id, patientId: insertedPatients[4]!.id, appointmentId: insertedAppointments[3]!.id,
      status: "paid", subtotal: "93.00", tax: "7.44", total: "100.44", paidAmount: "100.44", dueDate: dateStr(daysAgo(1)),
      items: [
        { description: "Office Exam", quantity: 1, unitPrice: "65.00", total: "65.00", itemType: "service" },
        { description: "Vaccination Administration", quantity: 1, unitPrice: "28.00", total: "28.00", itemType: "service" },
      ],
    },
    {
      practiceId, clientId: insertedClients[7]!.id, patientId: insertedPatients[7]!.id, appointmentId: insertedAppointments[4]!.id,
      status: "paid", subtotal: "430.00", tax: "34.40", total: "464.40", paidAmount: "464.40", dueDate: dateStr(daysAgo(3)),
      items: [
        { description: "Office Exam", quantity: 1, unitPrice: "65.00", total: "65.00", itemType: "service" },
        { description: "Dental Prophylaxis", quantity: 1, unitPrice: "365.00", total: "365.00", itemType: "service" },
      ],
    },
    // Sent invoices (2)
    {
      practiceId, clientId: insertedClients[3]!.id, patientId: luna.id, appointmentId: insertedAppointments[6]!.id,
      status: "sent", subtotal: "403.00", tax: "32.24", total: "435.24", paidAmount: "0.00", dueDate: dateStr(daysFromNow(25)),
      items: [
        { description: "Office Exam", quantity: 1, unitPrice: "65.00", total: "65.00", itemType: "service" },
        { description: "Radiograph (2 views)", quantity: 1, unitPrice: "190.00", total: "190.00", itemType: "service" },
        { description: "CBC/Chemistry Panel", quantity: 1, unitPrice: "148.00", total: "148.00", itemType: "service" },
      ],
    },
    {
      practiceId, clientId: insertedClients[1]!.id, patientId: insertedPatients[9]!.id, appointmentId: insertedAppointments[5]!.id,
      status: "sent", subtotal: "93.00", tax: "7.44", total: "100.44", paidAmount: "0.00", dueDate: dateStr(daysFromNow(20)),
      items: [
        { description: "Office Exam", quantity: 1, unitPrice: "65.00", total: "65.00", itemType: "service" },
        { description: "Vaccination Administration", quantity: 1, unitPrice: "28.00", total: "28.00", itemType: "service" },
      ],
    },
    // Draft invoices (2)
    {
      practiceId, clientId: insertedClients[0]!.id, patientId: insertedPatients[8]!.id, appointmentId: null,
      status: "draft", subtotal: "83.00", tax: "6.64", total: "89.64", paidAmount: "0.00", dueDate: dateStr(daysFromNow(30)),
      items: [
        { description: "Office Exam", quantity: 1, unitPrice: "65.00", total: "65.00", itemType: "service" },
        { description: "Nail Trim", quantity: 1, unitPrice: "18.00", total: "18.00", itemType: "service" },
      ],
    },
    {
      practiceId, clientId: insertedClients[5]!.id, patientId: insertedPatients[11]!.id, appointmentId: insertedAppointments[7]!.id,
      status: "draft", subtotal: "251.00", tax: "20.08", total: "271.08", paidAmount: "0.00", dueDate: dateStr(daysFromNow(30)),
      items: [
        { description: "Office Exam", quantity: 1, unitPrice: "65.00", total: "65.00", itemType: "service" },
        { description: "CBC/Chemistry Panel", quantity: 1, unitPrice: "148.00", total: "148.00", itemType: "service" },
        { description: "Fecal Float Test", quantity: 1, unitPrice: "38.00", total: "38.00", itemType: "service" },
      ],
    },
  ];

  const insertedInvoices = await db
    .insert(invoices)
    .values(
      invoiceRecords.map(({ items, ...inv }) => inv)
    )
    .returning();
  console.log(`Invoices: ${insertedInvoices.length} created`);

  // Invoice items
  const allInvoiceItems: { invoiceId: string; description: string; quantity: number; unitPrice: string; total: string; itemType: "service" | "product" }[] = [];
  for (let i = 0; i < insertedInvoices.length; i++) {
    const inv = insertedInvoices[i]!;
    const record = invoiceRecords[i]!;
    for (const item of record.items) {
      allInvoiceItems.push({ invoiceId: inv.id, ...item });
    }
  }

  await db.insert(invoiceItems).values(allInvoiceItems);
  console.log(`Invoice items: ${allInvoiceItems.length} created`);

  // =========================================================================
  // 13. Prescriptions (4) — common vet meds
  // =========================================================================
  const prescriptionValues = [
    {
      practiceId,
      patientId: insertedPatients[1]!.id, // Zara (GI issues)
      medicationName: "Clavamox (Amoxicillin/Clavulanate)",
      dosage: "375mg",
      frequency: "BID (twice daily)",
      quantity: 28,
      refillsRemaining: 0,
      prescribedBy: drRodriguez.id,
      startDate: dateStr(daysAgo(12)),
      endDate: dateStr(daysFromNow(2)),
      status: "active" as const,
      instructions: "Give one tablet by mouth twice daily with food for 14 days. Complete the full course even if symptoms improve. May cause mild GI upset.",
    },
    {
      practiceId,
      patientId: luna.id, // Luna (emergency visit)
      medicationName: "Cerenia (Maropitant)",
      dosage: "16mg",
      frequency: "SID (once daily)",
      quantity: 4,
      refillsRemaining: 0,
      prescribedBy: drMitchell.id,
      startDate: dateStr(daysAgo(3)),
      endDate: dateStr(daysFromNow(1)),
      status: "active" as const,
      instructions: "Give one tablet once daily for anti-nausea. Can be given with a small amount of food. If vomiting resumes, return for recheck immediately.",
    },
    {
      practiceId,
      patientId: biscuit.id, // Biscuit (joint supplement per SOAP)
      medicationName: "Carprofen (Rimadyl)",
      dosage: "75mg",
      frequency: "BID (twice daily) with food",
      quantity: 60,
      refillsRemaining: 2,
      prescribedBy: drMitchell.id,
      startDate: dateStr(daysAgo(30)),
      endDate: dateStr(daysFromNow(0)),
      status: "active" as const,
      instructions: "Give one tablet by mouth twice daily with food for pain/inflammation. Do not combine with other NSAIDs or corticosteroids. Monitor appetite and stool.",
    },
    {
      practiceId,
      patientId: insertedPatients[11]!.id, // Cleo (URI)
      medicationName: "Doxycycline",
      dosage: "50mg",
      frequency: "BID (twice daily)",
      quantity: 20,
      refillsRemaining: 0,
      prescribedBy: drRodriguez.id,
      startDate: dateStr(daysAgo(2)),
      endDate: dateStr(daysFromNow(8)),
      status: "active" as const,
      instructions: "Give one capsule by mouth twice daily for 10 days. Follow with water or small amount of food to prevent esophageal irritation. Complete full course.",
    },
  ];

  await db.insert(prescriptions).values(prescriptionValues);
  console.log(`Prescriptions: ${prescriptionValues.length} created`);

  // =========================================================================
  // Done!
  // =========================================================================
  console.log("\nDemo seed completed successfully!");
  console.log(`
Summary:
  - 1 practice: Pawsitive Care Veterinary Hospital
  - ${insertedLocations.length} locations
  - ${insertedUsers.length} staff members (2 vets, 1 tech, 1 front desk)
  - ${insertedClients.length} clients
  - ${insertedPatients.length} patients (9 dogs, 7 cats, 2 rabbits)
  - ${weightEntries.length} weight records
  - 4 allergies
  - ${insertedApptTypes.length} appointment types
  - ${insertedRooms.length} rooms
  - ${insertedServices.length} services
  - ${insertedAppointments.length} appointments
  - ${soapNotesToInsert.length} SOAP notes
  - ${vaccinationValues.length} vaccination records
  - ${insertedInvoices.length} invoices with ${allInvoiceItems.length} line items
  - ${prescriptionValues.length} prescriptions

Login credentials (all users):
  Password: demo123
  Emails:
    - sarah.chen@pawsitivecarevet.example.com (admin/vet)
    - james.rodriguez@pawsitivecarevet.example.com (veterinarian)
    - emily.chen@pawsitivecarevet.example.com (technician)
    - lisa.park@pawsitivecarevet.example.com (front desk)
  `);
}

seedDemo()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Demo seed failed:", err);
    process.exit(1);
  });
