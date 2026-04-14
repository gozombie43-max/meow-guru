export async function POST(req: Request) {
  const formData = await req.formData();

  const res = await fetch(
    "http://localhost:5000/api/upload/image-question",
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
