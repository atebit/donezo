export function generateInvitationToken(): string {
  const bytes = new Uint8Array(24); // 192 bits
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
