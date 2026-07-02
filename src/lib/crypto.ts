import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM encryption for Plaid access tokens at rest.
// Stored format: iv.ciphertext.authTag (hex, dot-separated).

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-char hex string (openssl rand -hex 32)"
    );
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return [
    iv.toString("hex"),
    encrypted.toString("hex"),
    cipher.getAuthTag().toString("hex"),
  ].join(".");
}

export function decrypt(stored: string): string {
  const [ivHex, dataHex, tagHex] = stored.split(".");
  if (!ivHex || !dataHex || !tagHex) throw new Error("Malformed ciphertext");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
