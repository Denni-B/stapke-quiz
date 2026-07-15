const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const apiOrigin = process.env.NEXT_PUBLIC_API_ORIGIN ?? "";

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;

  if (apiOrigin) {
    return `${apiOrigin.replace(/\/$/, "")}${normalized}`;
  }

  return `${basePath}${normalized}`;
}
