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

export async function fetchPublic(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const requestKey = getRequestKey(url, options);

  // Check if request is already in flight
  const existingRequest = inFlightRequests.get(requestKey);
  if (existingRequest) {
    return existingRequest;
  }

  const headers = {
    ...(options.headers || {}),
    "Content-Type": "application/json",
  };

  const requestPromise = fetch(url, {
    ...options,
    headers,
  })
    .then((res) => {
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
