import { createAuthClient } from "better-auth/react";
export const API =
  process.env.NEXT_PUBLIC_API_URL || "https://api.nouvel-ordre.fr";
export const authClient = createAuthClient({
  baseURL: API,
  basePath: "/api/auth",
  fetchOptions: { credentials: "include" },
});
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const r = await fetch(API + path, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const body = await r
    .json()
    .catch(() => ({ error: "Réponse du service illisible." }));
  if (!r.ok) throw new Error(body.error || "La requête a échoué.");
  return body;
}
export const post = (path: string, body: unknown) =>
  api(path, { method: "POST", body: JSON.stringify(body) });
