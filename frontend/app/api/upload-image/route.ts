import { fetchWithRetry } from "@/lib/api/http";

export async function POST(req: Request) {
  const formData = await req.formData();
  const backendUrl = process.env.API_URL || "http://localhost:10000";

  const res = await fetchWithRetry(
    `${backendUrl}/api/upload/image-question`,
    {
      method: "POST",
      headers: {
        "x-admin-secret": process.env.ADMIN_SECRET!,
      },
      body: formData,
    },
    {
      attempts: 3,
      timeoutMs: 20000,
      retryDelayMs: 5000,
      retryMethods: ["POST"],
      retryOnStatuses: [502, 503, 504],
    }
  );

  const data = await res.json();
  return Response.json(data, { status: res.status });
}
