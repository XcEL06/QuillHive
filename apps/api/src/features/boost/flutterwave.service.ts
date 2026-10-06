import crypto from "crypto";

const FLW_BASE = "https://api.flutterwave.com/v3";

export interface FlwVerifyResult {
  status: "successful" | "failed" | "pending";
  amount: number;
  currency: string;
  txRef: string;
  transactionId: number;
  meta: Record<string, string>;
}

export async function verifyTransaction(transactionId: string | number): Promise<FlwVerifyResult> {
  const secretKey = process.env.FLW_SECRET_KEY ?? process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secretKey) throw new Error("FLW_SECRET_KEY / FLUTTERWAVE_SECRET_KEY is not configured");

  const res = await fetch(`${FLW_BASE}/transactions/${transactionId}/verify`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Flutterwave verify failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as {
    status: string;
    message: string;
    data: {
      id: number;
      status: string;
      amount: number;
      currency: string;
      tx_ref: string;
      meta?: Record<string, string>;
    };
  };

  if (json.status !== "success") throw new Error(`Flutterwave error: ${json.message}`);

  const d = json.data;
  return {
    status: d.status as FlwVerifyResult["status"],
    amount: d.amount,
    currency: d.currency,
    txRef: d.tx_ref,
    transactionId: d.id,
    meta: d.meta ?? {},
  };
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secretHash = process.env.FLW_WEBHOOK_SECRET ?? process.env.FLW_ENCRYPTION_KEY;
  if (!secretHash) return false;
  const signatureBuffer = Buffer.from(signature);
  const secretBuffer = Buffer.from(secretHash);
  if (signatureBuffer.length !== secretBuffer.length) return false;
  return crypto.timingSafeEqual(signatureBuffer, secretBuffer);
}

export function generateTxRef(prefix: string): string {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}
