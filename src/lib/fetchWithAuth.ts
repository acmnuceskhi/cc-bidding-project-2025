// This helper can be used anywhere (client-side only)
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem("token");

  // Attach Authorization header if token exists
  const headers = {
    ...(options.headers || {}),
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  // --- Handle expired / invalid token ---
  if (res.status === 401) {
    console.warn("[Auth] Token expired or invalid. Logging out.");

    // Clear stored session
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("houseId");

    // Optional: redirect to login
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }

  return res;
}
