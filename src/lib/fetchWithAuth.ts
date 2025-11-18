// Request deduplication: track in-flight requests and snapshot bodies once
type ResponseSnapshot = {
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
  body: ArrayBuffer;
};
const inFlightRequests = new Map<string, Promise<ResponseSnapshot>>();

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
    // Build a fresh Response from the cached snapshot
    return existingRequest.then((snap) =>
      new Response(snap.body.slice(0), {
        status: snap.status,
        statusText: snap.statusText,
        headers: new Headers(snap.headers),
      })
    );
  }

  const token = sessionStorage.getItem("token");

  // Attach Authorization header if token exists
  const headers = {
    ...(options.headers || {}),
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const requestPromise: Promise<ResponseSnapshot> = fetch(url, {
    ...options,
    headers,
  })
    .then(async (res) => {
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

      // Snapshot the response body and headers once
      let body: ArrayBuffer;
      try {
        body = await res.clone().arrayBuffer();
      } catch (e) {
        // If cloning fails for any reason, attempt to read directly
        try {
          body = await res.arrayBuffer();
        } catch (err) {
          // As a last resort, create an empty body
          body = new ArrayBuffer(0);
        }
      }

      const headersArray = Array.from(res.headers.entries());

      // Remove from in-flight after a short delay to allow deduplication window
      setTimeout(() => {
        inFlightRequests.delete(requestKey);
      }, 100);

      return {
        status: res.status,
        statusText: res.statusText,
        headers: headersArray,
        body,
      } as ResponseSnapshot;
    })
    .catch((error) => {
      inFlightRequests.delete(requestKey);
      throw error;
    });

  inFlightRequests.set(requestKey, requestPromise);
  // Return a fresh Response for the initial caller as well
  return requestPromise.then((snap) =>
    new Response(snap.body.slice(0), {
      status: snap.status,
      statusText: snap.statusText,
      headers: new Headers(snap.headers),
    })
  );
}
