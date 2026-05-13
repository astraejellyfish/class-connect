import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { question } = await req.json();

    if (!question || typeof question !== "string") {
      return jsonResponse({ error: "Missing question" }, 400);
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      return jsonResponse({ error: "Missing GEMINI_API_KEY" }, 500);
    }

    const prompt = `
You are Class Connect Ask AI, a helpful classroom assistant for instructors and students.

Answer the user's question clearly and simply.

Rules:
- Do NOT create a participation summary.
- Do NOT mention session participation unless the user asks about it.
- Do NOT include report headings.
- Keep the answer short, helpful, and classroom-friendly.
- If the user asks for a lesson question, give useful sample questions.
- If the user asks for an explanation, explain in simple terms.

User question:
${question}
`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            topP: 0.8,
            maxOutputTokens: 700,
          },
        }),
      }
    );

    const data = await geminiRes.json();

    console.log("Ask AI Gemini Status:", geminiRes.status);
    console.log("Ask AI Gemini Response:", JSON.stringify(data));

    if (!geminiRes.ok) {
      console.error("Gemini Error:", data);

      if (geminiRes.status === 429) {
        return jsonResponse(
          {
            error: "AI quota reached. Please try again later.",
          },
          429
        );
      }

      return jsonResponse(
        {
          error: data.error?.message || "Gemini request failed",
        },
        geminiRes.status
      );
    }

    const answer =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "No answer generated.";

    return jsonResponse({ answer });
  } catch (error) {
    console.error("Ask AI Function Error:", error);
    return jsonResponse({ error: String(error) }, 500);
  }
});
