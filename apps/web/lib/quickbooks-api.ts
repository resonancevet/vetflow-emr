import { and, eq, isNull } from "drizzle-orm";
import { quickbooksConnections } from "@openpims/db";
import type { Database } from "@openpims/db/client";
import { decryptSecret, encryptSecret } from "./quickbooks-crypto";
import {
  quickbooksApiBase,
  refreshAccessToken,
} from "./quickbooks-oauth";

type Connection = typeof quickbooksConnections.$inferSelect;

export class QuickBooksApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
    public intuitTid?: string | null
  ) {
    super(message);
    this.name = "QuickBooksApiError";
  }
}

function readIntuitTid(res: Response): string | null {
  return (
    res.headers.get("intuit_tid") ||
    res.headers.get("Intuit-Tid") ||
    null
  );
}

async function qboFetch<T>(
  accessToken: string,
  realmId: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${quickbooksApiBase()}/v3/company/${realmId}${path}${
    path.includes("?") ? "&" : "?"
  }minorversion=75`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const intuitTid = readIntuitTid(res);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    const fault =
      typeof json === "object" &&
      json &&
      "Fault" in json &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (json as any).Fault?.Error?.[0]?.Message;
    const baseMsg = fault || `QuickBooks API error (${res.status})`;
    const message = intuitTid
      ? `${baseMsg} (intuit_tid: ${intuitTid})`
      : baseMsg;
    console.error("[QuickBooks] API error", {
      status: res.status,
      path,
      realmId,
      intuit_tid: intuitTid,
      message: baseMsg,
    });
    throw new QuickBooksApiError(message, res.status, json, intuitTid);
  }
  return json as T;
}

export async function getValidAccessToken(
  db: Database,
  connection: Connection
): Promise<{ accessToken: string; connection: Connection }> {
  const expiresSoon =
    connection.accessTokenExpiresAt.getTime() - Date.now() < 2 * 60 * 1000;
  if (!expiresSoon) {
    return {
      accessToken: decryptSecret(connection.accessTokenEnc),
      connection,
    };
  }

  const refreshed = await refreshAccessToken(
    decryptSecret(connection.refreshTokenEnc)
  );
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
  const [updated] = await db
    .update(quickbooksConnections)
    .set({
      accessTokenEnc: encryptSecret(refreshed.access_token),
      refreshTokenEnc: encryptSecret(refreshed.refresh_token),
      accessTokenExpiresAt: expiresAt,
      updatedAt: new Date(),
      lastError: null,
    })
    .where(eq(quickbooksConnections.id, connection.id))
    .returning();

  return {
    accessToken: refreshed.access_token,
    connection: updated ?? connection,
  };
}

export async function loadActiveConnection(
  db: Database,
  practiceId: string
): Promise<Connection | null> {
  const [row] = await db
    .select()
    .from(quickbooksConnections)
    .where(
      and(
        eq(quickbooksConnections.practiceId, practiceId),
        isNull(quickbooksConnections.deletedAt)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function qboGetCompanyName(
  accessToken: string,
  realmId: string
): Promise<string> {
  const data = await qboFetch<{
    CompanyInfo?: { CompanyName?: string };
  }>(accessToken, realmId, `/companyinfo/${realmId}`);
  return data.CompanyInfo?.CompanyName ?? "QuickBooks company";
}

export async function qboQuery<T>(
  accessToken: string,
  realmId: string,
  sql: string
): Promise<T[]> {
  const data = await qboFetch<{ QueryResponse?: Record<string, T[]> }>(
    accessToken,
    realmId,
    `/query?query=${encodeURIComponent(sql)}`
  );
  const response = data.QueryResponse ?? {};
  const firstKey = Object.keys(response).find((k) => k !== "startPosition" && k !== "maxResults" && k !== "totalCount");
  if (!firstKey) return [];
  return response[firstKey] ?? [];
}

export async function qboCreateCustomer(
  accessToken: string,
  realmId: string,
  input: {
    displayName: string;
    email?: string | null;
    phone?: string | null;
  }
): Promise<string> {
  // DisplayName must be unique in QBO — append a short suffix if needed later.
  const body = {
    DisplayName: input.displayName.slice(0, 100),
    PrimaryEmailAddr: input.email
      ? { Address: input.email }
      : undefined,
    PrimaryPhone: input.phone ? { FreeFormNumber: input.phone } : undefined,
  };
  const data = await qboFetch<{ Customer?: { Id?: string } }>(
    accessToken,
    realmId,
    "/customer",
    { method: "POST", body: JSON.stringify(body) }
  );
  const id = data.Customer?.Id;
  if (!id) throw new Error("QuickBooks did not return a customer id");
  return id;
}

export async function qboFindOrCreateServiceItem(
  accessToken: string,
  realmId: string,
  incomeAccountId: string
): Promise<string> {
  const existing = await qboQuery<{ Id: string; Name: string }>(
    accessToken,
    realmId,
    "select * from Item where Name = 'VetRoamer Sales' maxresults 1"
  );
  if (existing[0]?.Id) return existing[0].Id;

  const data = await qboFetch<{ Item?: { Id?: string } }>(
    accessToken,
    realmId,
    "/item",
    {
      method: "POST",
      body: JSON.stringify({
        Name: "VetRoamer Sales",
        Type: "Service",
        IncomeAccountRef: { value: incomeAccountId },
      }),
    }
  );
  const id = data.Item?.Id;
  if (!id) throw new Error("QuickBooks did not return an item id");
  return id;
}

export async function qboListAccounts(
  accessToken: string,
  realmId: string
): Promise<Array<{ id: string; name: string; accountType: string }>> {
  const rows = await qboQuery<{
    Id: string;
    Name: string;
    AccountType: string;
    Active?: boolean;
  }>(
    accessToken,
    realmId,
    "select Id, Name, AccountType, Active from Account where Active = true maxresults 1000"
  );
  return rows.map((r) => ({
    id: r.Id,
    name: r.Name,
    accountType: r.AccountType,
  }));
}

export async function qboCreateInvoice(
  accessToken: string,
  realmId: string,
  input: {
    customerId: string;
    itemId: string;
    dueDate?: string | null;
    docNumber?: string | null;
    lines: Array<{ description: string; amount: number }>;
  }
): Promise<string> {
  const line = input.lines
    .filter((l) => l.amount !== 0)
    .map((l) => ({
      Amount: Math.round(l.amount * 100) / 100,
      DetailType: "SalesItemLineDetail",
      Description: l.description.slice(0, 4000),
      SalesItemLineDetail: {
        ItemRef: { value: input.itemId },
      },
    }));

  if (line.length === 0) {
    throw new Error("Invoice has no line amounts to sync");
  }

  const body: Record<string, unknown> = {
    CustomerRef: { value: input.customerId },
    Line: line,
  };
  if (input.dueDate) body.DueDate = input.dueDate;
  if (input.docNumber) body.DocNumber = input.docNumber.slice(0, 21);

  const data = await qboFetch<{ Invoice?: { Id?: string } }>(
    accessToken,
    realmId,
    "/invoice",
    { method: "POST", body: JSON.stringify(body) }
  );
  const id = data.Invoice?.Id;
  if (!id) throw new Error("QuickBooks did not return an invoice id");
  return id;
}

export async function qboCreatePayment(
  accessToken: string,
  realmId: string,
  input: {
    customerId: string;
    invoiceId: string;
    amount: number;
    depositAccountId?: string | null;
    paymentDate?: string;
  }
): Promise<string> {
  const amount = Math.round(input.amount * 100) / 100;
  const body: Record<string, unknown> = {
    CustomerRef: { value: input.customerId },
    TotalAmt: amount,
    Line: [
      {
        Amount: amount,
        LinkedTxn: [
          {
            TxnId: input.invoiceId,
            TxnType: "Invoice",
          },
        ],
      },
    ],
  };
  if (input.depositAccountId) {
    body.DepositToAccountRef = { value: input.depositAccountId };
  }
  if (input.paymentDate) body.TxnDate = input.paymentDate;

  const data = await qboFetch<{ Payment?: { Id?: string } }>(
    accessToken,
    realmId,
    "/payment",
    { method: "POST", body: JSON.stringify(body) }
  );
  const id = data.Payment?.Id;
  if (!id) throw new Error("QuickBooks did not return a payment id");
  return id;
}
