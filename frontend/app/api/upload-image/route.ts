import { fetchWithRetry } from "@/lib/api/http";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const contentLengthHeader = req.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES) {
      return Response.json(
        { error: "Upload payload exceeds 10 MB limit" },
        { status: 413 }
      );
    }
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  let totalBytes = 0;
  for (const [, value] of formData.entries()) {
    if (typeof value === "string") {
      totalBytes += new TextEncoder().encode(value).byteLength;
    } else if (value && typeof (value as Blob).size === "number") {
      const blobSize = (value as Blob).size;
      if (blobSize > MAX_UPLOAD_BYTES) {
        return Response.json(
          { error: "Uploaded file exceeds 10 MB limit" },
          { status: 413 }
        );
      }
      totalBytes += blobSize;
    }
    if (totalBytes > MAX_UPLOAD_BYTES) {
      return Response.json(
        { error: "Upload payload exceeds 10 MB limit" },
        { status: 413 }
      );
    }
  }

  const examMode = new URL(req.url).searchParams.get("examMode");
  const backendUrl = (process.env.API_URL || "http://localhost:10000").replace(/\/+$/, "");

  const forwardHeaders: Record<string, string> = {
    Authorization: authorization,
  };
  const requestId = req.headers.get("x-request-id");
  if (requestId) forwardHeaders["X-Request-ID"] = requestId;
  const traceparent = req.headers.get("traceparent");
  if (traceparent) forwardHeaders["traceparent"] = traceparent;
  const idempotencyKey = req.headers.get("idempotency-key");
  if (idempotencyKey) forwardHeaders["Idempotency-Key"] = idempotencyKey;

  try {
    const res = await fetchWithRetry(
      `${backendUrl}/api/upload/image-question${examMode ? `?examMode=${encodeURIComponent(examMode)}` : ""}`,
      {
        method: "POST",
        headers: forwardHeaders,
        body: formData,
        signal: req.signal,
      },
      {
        attempts: 1,
        timeoutMs: 20000,
        retryDelayMs: 5000,
        retryOnStatuses: [502, 503, 504],
      }
    );

    const rawText = await res.text();
    let parsed: unknown = null;
    if (rawText) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = null;
      }
    }

    if (parsed !== null && typeof parsed === "object") {
      return Response.json(parsed, { status: res.status });
    }

    return Response.json(
      {
        error: res.ok
          ? "Invalid response from upload service"
          : `Upload service returned status ${res.status}`,
      },
      { status: res.ok ? 502 : res.status }
    );
  } catch (err) {
    if (req.signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
      return Response.json({ error: "Upload request aborted" }, { status: 499 });
    }
    return Response.json(
      { error: "Upload service currently unavailable" },
      { status: 503 }
    );
  }
}
