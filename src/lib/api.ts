const API_URL = process.env.NEXT_PUBLIC_API_URL!;

if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is missing. Set it in .env.local");
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);

  // Only set JSON header when sending a body
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || `Request failed: ${res.status}`;
    const err: any = new Error(
      Array.isArray(msg) ? msg.join(", ") : String(msg),
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
