export interface LabOrder {
  orderId: string;
  patientId: string;
  practiceId: string;
  provider: "idexx" | "antech" | "zoetis" | "in_house";
  testCodes: string[];
  status: "pending" | "submitted" | "in_progress" | "completed" | "cancelled";
  orderedAt: string;
  results?: LabResultItem[];
}

export interface LabResultItem {
  testName: string;
  resultValue: string;
  unit: string;
  referenceRangeLow?: string;
  referenceRangeHigh?: string;
  isAbnormal: boolean;
  flag?: "high" | "low" | "critical";
}

export interface LabProvider {
  name: string;
  id: "idexx" | "antech" | "zoetis" | "in_house";
  submitOrder(order: LabOrder): Promise<{ success: boolean; externalOrderId?: string }>;
  checkStatus(externalOrderId: string): Promise<LabOrder>;
  getResults(externalOrderId: string): Promise<LabResultItem[]>;
}

// In-house lab provider (for manual result entry)
export const inHouseProvider: LabProvider = {
  name: "In-House Lab",
  id: "in_house",
  async submitOrder(order) {
    return { success: true, externalOrderId: order.orderId };
  },
  async checkStatus(externalOrderId) {
    return {
      orderId: externalOrderId,
      patientId: "",
      practiceId: "",
      provider: "in_house",
      testCodes: [],
      status: "pending",
      orderedAt: new Date().toISOString(),
    };
  },
  async getResults() {
    return [];
  },
};

// Stub providers that log to console (ready for real API integration)
function createStubProvider(
  name: string,
  id: "idexx" | "antech" | "zoetis"
): LabProvider {
  return {
    name,
    id,
    async submitOrder(order) {
      console.log(`[${name}] Order submitted:`, order.testCodes);
      return { success: true, externalOrderId: `${id}-${Date.now()}` };
    },
    async checkStatus(externalOrderId) {
      console.log(`[${name}] Checking status:`, externalOrderId);
      return {
        orderId: externalOrderId,
        patientId: "",
        practiceId: "",
        provider: id,
        testCodes: [],
        status: "pending",
        orderedAt: new Date().toISOString(),
      };
    },
    async getResults(externalOrderId) {
      console.log(`[${name}] Getting results:`, externalOrderId);
      return [];
    },
  };
}

export const labProviders: Record<string, LabProvider> = {
  idexx: createStubProvider("IDEXX VetConnect", "idexx"),
  antech: createStubProvider("Antech Diagnostics", "antech"),
  zoetis: createStubProvider("Zoetis Reference Labs", "zoetis"),
  in_house: inHouseProvider,
};

export function getProvider(id: string): LabProvider | undefined {
  return labProviders[id];
}
