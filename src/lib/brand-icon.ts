/** Cache-busting path so the browser tab picks up a newly saved logo. */
export function brandIconHref(logoDataUrl: string): string {
  return `/icon?v=${logoVersion(logoDataUrl)}`;
}

export function logoVersion(logoDataUrl: string): string {
  if (!logoDataUrl) return "0";
  let hash = 0;
  for (let index = 0; index < logoDataUrl.length; index += 97) {
    hash = (Math.imul(hash, 33) + logoDataUrl.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

export function decodeDataImage(value: string): { type: string; bytes: Uint8Array } | null {
  const match = value.trim().match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  const type = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
  if (!["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"].includes(type)) return null;
  const bytes = Uint8Array.from(Buffer.from(match[2].replace(/\s/g, ""), "base64"));
  if (bytes.byteLength === 0) return null;
  return { type, bytes };
}

export function letterIcon(name: string): string {
  const letter = (name.trim().slice(0, 1) || "D").toUpperCase().replace(/[<>&"']/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#22d3ee"/><text x="32" y="44" text-anchor="middle" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="#0f172a">${letter}</text></svg>`;
}
