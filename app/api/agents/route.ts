export async function POST(req: Request) {
  const body = await req.json();

  const response = await fetch(
    "http://localhost:8000/agent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();

  return Response.json(data);
}