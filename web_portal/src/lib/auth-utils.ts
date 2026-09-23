/**
 * Computes SHA-256 hash formatted as lowercase hex string,
 * matching Flutter app's:
 *   final bytes = utf8.encode('$salt:$password');
 *   return sha256.convert(bytes).toString();
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${password}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function validatePassword(password: string): string | null {
  if (!password || !password.trim()) {
    return "Password is required.";
  }
  if (password.trim().length < 8) {
    return "Password must be at least 8 characters long.";
  }
  return null;
}
