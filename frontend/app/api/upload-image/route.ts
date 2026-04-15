export async function POST(req: Request) {
  const formData = await req.formData();
  const backendUrl = process.env.API_URL || "http://localhost:10000";

  const res = await fetch(
    `${backendUrl}/api/upload/image-question`,  // ← fixed path
    {
      method: "POST",
      headers: {
        "x-admin-secret": process.env.ADMIN_SECRET!,
      },
      body: formData,
    }
  );

  const data = await res.json();
  return Response.json(data);
}