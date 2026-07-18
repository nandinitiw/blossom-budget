import { createHash } from "crypto";
import { importJWK, jwtVerify, decodeProtectedHeader } from "jose";
import { plaidClient } from "@/lib/plaid";

// Shape of the EC public key Plaid returns from /webhook_verification_key/get.
type PlaidJWK = {
  kty: string;
  crv: string;
  x: string;
  y: string;
  expired_at: number | null;
};

// Verifies a Plaid webhook per https://plaid.com/docs/api/webhooks/webhook-verification/
//
// Plaid signs each webhook with an ES256 JWT in the `Plaid-Verification` header.
// The JWT's `request_body_sha256` claim must match the SHA-256 of the raw
// request body, which proves the body wasn't tampered with. We also reject
// tokens older than 5 minutes to blunt replay.
//
// Keys are cached in module memory to avoid a Plaid API call on every webhook.
const keyCache = new Map<string, PlaidJWK>();

async function getVerificationKey(keyId: string): Promise<PlaidJWK | null> {
  const cached = keyCache.get(keyId);
  if (cached) return cached;
  try {
    const res = await plaidClient.webhookVerificationKeyGet({ key_id: keyId });
    const key = res.data.key;
    // Only cache currently-valid keys
    if (!key.expired_at) keyCache.set(keyId, key);
    return key;
  } catch (err) {
    console.error("[plaid-webhook] failed to fetch verification key", err);
    return null;
  }
}

export async function verifyPlaidWebhook(
  verificationHeader: string | null,
  rawBody: string
): Promise<boolean> {
  if (!verificationHeader) return false;

  let keyId: string;
  try {
    const header = decodeProtectedHeader(verificationHeader);
    if (header.alg !== "ES256" || !header.kid) return false;
    keyId = header.kid;
  } catch {
    return false;
  }

  const jwk = await getVerificationKey(keyId);
  if (!jwk || jwk.expired_at) return false;

  try {
    const key = await importJWK(
      { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
      "ES256"
    );
    // Verifies signature; maxTokenAge rejects tokens older than 5 minutes.
    const { payload } = await jwtVerify(verificationHeader, key, {
      maxTokenAge: "5 min",
      clockTolerance: "1 min",
    });

    const expected = createHash("sha256").update(rawBody, "utf8").digest("hex");
    const claimed = payload.request_body_sha256;
    return typeof claimed === "string" && timingSafeEqualHex(claimed, expected);
  } catch (err) {
    console.error("[plaid-webhook] verification failed", err);
    return false;
  }
}

// Constant-time compare of two equal-length hex strings.
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
