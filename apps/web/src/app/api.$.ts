import { app } from "@sockets/api";
import { createFileRoute } from "@tanstack/react-router";

const handle = async ({ request }: { request: Request }) => {
  const headers = new Headers(request.headers);
  headers.set("x-api-key", process.env.API_KEY ?? "");

  const url = new URL(request.url, "http://localhost").href;
  const hasBody = request.body !== null && !["GET", "HEAD"].includes(request.method);
  const modifiedRequest = new Request(url, {
    method: request.method,
    headers,
    ...(hasBody ? { body: request.body, duplex: "half" } : {}),
  } as RequestInit);
  const response = await app.fetch(modifiedRequest);
  if (!response.ok) {
    const body = await response.clone().text();
    console.error(
      `[API] ${request.method} ${request.url} ${response.status}`,
      body,
    );
  }
  return response;
};

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      PUT: handle,
      PATCH: handle,
      DELETE: handle,
    },
  },
});
