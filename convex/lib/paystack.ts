// Paystack REST client. Server-only — reads PAYSTACK_SECRET_KEY from the
// Convex deployment env. All amounts are in the currency subunit (cents for
// ZAR). Runs in the default Convex runtime (fetch is available; no "use node").

const PAYSTACK_BASE = "https://api.paystack.co";

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  return key;
}

async function paystackFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json()) as {
    status?: boolean;
    message?: string;
    data?: T;
  };
  if (!res.ok || json.status === false) {
    throw new Error(`Paystack ${path} failed: ${json.message ?? res.status}`);
  }
  return json.data as T;
}

// Creating a customer with an email that already exists returns the existing
// customer, so this doubles as get-or-create.
export async function getOrCreateCustomer(input: {
  email: string;
  firstName?: string;
  phone?: string;
}): Promise<{ customer_code: string }> {
  return paystackFetch("/customer", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      first_name: input.firstName,
      phone: input.phone,
    }),
  });
}

// Passing `plan` charges the plan price and auto-creates the subscription on
// the first successful charge — no separate Subscriptions API call needed.
export async function initializeTransaction(input: {
  email: string;
  planCode: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<{
  authorization_url: string;
  access_code: string;
  reference: string;
}> {
  return paystackFetch("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      plan: input.planCode,
      reference: input.reference,
      callback_url: input.callbackUrl,
      currency: "ZAR",
      channels: ["card"],
      metadata: input.metadata,
    }),
  });
}

export async function verifyTransaction(reference: string): Promise<{
  status: string;
  customer?: { customer_code?: string };
  plan?: string;
  metadata?: Record<string, unknown>;
}> {
  return paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`);
}

export async function createPlan(input: {
  name: string;
  amount: number; // cents
}): Promise<{ plan_code: string }> {
  return paystackFetch("/plan", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      interval: "monthly",
      amount: input.amount,
      currency: "ZAR",
    }),
  });
}

export async function disableSubscription(input: {
  code: string;
  token: string;
}): Promise<unknown> {
  return paystackFetch("/subscription/disable", {
    method: "POST",
    body: JSON.stringify({ code: input.code, token: input.token }),
  });
}

export async function subscriptionManageLink(
  code: string
): Promise<{ link: string }> {
  return paystackFetch(`/subscription/${encodeURIComponent(code)}/manage/link`);
}
