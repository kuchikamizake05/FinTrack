export function maskUserIdentifier(identifier: string | null | undefined) {
  if (!identifier) return "Memuat identitas...";
  if (identifier.length <= 16) return identifier;
  return `${identifier.slice(0, 8)}…${identifier.slice(-4)}`;
}
