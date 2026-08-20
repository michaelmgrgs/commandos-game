import crypto from "crypto";

/**
 * Generates an opaque, cryptographically random token for a player's QR
 * code / login link. Never sequential, never encodes role/team/id — see
 * the architecture doc's QR security model section.
 */
export function generateToken(bytes = 18): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/**
 * A player's QR encodes a full link like https://yourdomain.com/p/{token}
 * so a stray phone camera app just opens their profile instead of showing
 * useless text. When our own in-app scanner reads it back, pull the token
 * back out — falling back to treating the raw scanned text as the token
 * itself, in case someone points the scanner at a plain token string.
 */
export function extractTokenFromScan(raw: string): string {
  const match = raw.match(/\/p\/([A-Za-z0-9_-]+)/);
  if (match) return match[1];
  return raw.trim();
}

export function playerProfileUrl(origin: string, token: string): string {
  return `${origin}/p/${token}`;
}
