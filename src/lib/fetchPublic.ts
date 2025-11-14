export async function fetchPublic(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = {
    ...(options.headers || {}),
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  return res;
}
