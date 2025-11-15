// Request deduplication: track in-flight requests
const inFlightRequests = new Map<string, Promise<Response>>();

function getRequestKey(url: string, options: RequestInit): string {
  const method = options.method || "GET";
  const bodyHash = options.body
    ? typeof options.body === "string"
      ? options.body.slice(0, 100)
      : JSON.stringify(options.body).slice(0, 100)
    : "";
  return `${method}:${url}:${bodyHash}`;
}

// This helper can be used anywhere (client-side only)
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const requestKey = getRequestKey(url, options);

  // Check if request is already in flight
  const existingRequest = inFlightRequests.get(requestKey);
  if (existingRequest) {
    return existingRequest;
  }

  const token = sessionStorage.getItem("token");

  // Attach Authorization header if token exists
  const headers = {
    ...(options.headers || {}),
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const requestPromise = fetch(url, {
    ...options,
    headers,
  })
    .then((res) => {
      // --- Handle expired / invalid token ---
      if (res.status === 401) {
        console.warn("[Auth] Token expired or invalid. Logging out.");

        // Clear stored session
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("role");
        sessionStorage.removeItem("houseId");

        // Optional: redirect to login
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }

      // Remove from in-flight after a short delay to allow deduplication window
      setTimeout(() => {
        inFlightRequests.delete(requestKey);
      }, 100);

      return res;
    })
    .catch((error) => {
      inFlightRequests.delete(requestKey);
      throw error;
    });

  inFlightRequests.set(requestKey, requestPromise);
  return requestPromise;
}
