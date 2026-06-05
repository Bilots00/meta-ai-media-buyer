const CLOUDFLARE_WORKER_URL = "https://gelato-backend.andrea-bilotta00.workers.dev";

export async function workerFetch<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${CLOUDFLARE_WORKER_URL}${cleanPath}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} – ${text}`);
  }
  return res.json() as Promise<T>;
}

export const getTemplate = (templateId: string) =>
  workerFetch(`/gelato-get-template?templateId=${encodeURIComponent(templateId)}`);

export const bulkCreate = (payload: any) =>
  workerFetch(`/gelato-bulk-create`, { method: "POST", body: JSON.stringify(payload) });
