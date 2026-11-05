/**
 * Application IDs look like "VRT-7K3M9QX2AB": a prefix plus 10 random
 * Crockford base-32 characters (no I, L, O, U — easy to read aloud).
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ID_PATTERN = /^VRT-[0-9A-HJKMNP-TV-Z]{10}$/;

export function generateApplicationId(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return `VRT-${Array.from(bytes, (b) => ALPHABET[b % 32]).join("")}`;
}

export function isValidApplicationId(id: string): boolean {
  return ID_PATTERN.test(id);
}
