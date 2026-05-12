import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { texts, targetLang } = await req.json();
  const key = process.env.AZURE_TRANSLATOR_KEY || process.env.NEXT_PUBLIC_AZURE_TRANSLATOR_KEY;
  console.log("KEY present:", !!key, "length:", key?.length);

  const response = await fetch(
    `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=en&to=${targetLang}`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key!,
        "Ocp-Apim-Subscription-Region": "eastasia",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(texts.map((t: string) => ({ text: t }))),
    }
  );

  const data = await response.json();
  return NextResponse.json(data);
}
