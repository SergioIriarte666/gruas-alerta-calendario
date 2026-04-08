import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, categories } = await req.json();

    if (!description || typeof description !== "string" || description.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: "Description must be at least 3 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return new Response(
        JSON.stringify({ error: "Categories array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const catalogStr = categories
      .map((c: { id: string; name: string; subcategories?: string[] }) => {
        const subs = c.subcategories?.length ? ` [subcategorías: ${c.subcategories.join(", ")}]` : "";
        return `- id: "${c.id}" → "${c.name}"${subs}`;
      })
      .join("\n");

    const systemPrompt = `Eres un clasificador de gastos empresariales para una empresa de grúas y transporte en Chile. 
Dado el siguiente catálogo de categorías y subcategorías, clasifica la descripción del gasto.

CATÁLOGO:
${catalogStr}

REGLAS:
1. Responde SOLO con un JSON válido: { "category_id": "uuid", "subcategory": "nombre" o null, "confidence": 0.0-1.0 }
2. Si no estás seguro (confianza < 0.5), responde: { "category_id": null, "subcategory": null, "confidence": 0 }
3. Usa el id exacto del catálogo para category_id
4. Para subcategory usa el nombre exacto del catálogo o null si no aplica
5. No agregues explicaciones, solo el JSON`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Clasifica este gasto: "${description.trim()}"` },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI classification failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    try {
      const classification = JSON.parse(jsonStr);
      
      // Validate category_id exists in provided categories
      if (classification.category_id) {
        const validCategory = categories.find((c: { id: string }) => c.id === classification.category_id);
        if (!validCategory) {
          classification.category_id = null;
          classification.subcategory = null;
          classification.confidence = 0;
        }
      }

      return new Response(
        JSON.stringify(classification),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ category_id: null, subcategory: null, confidence: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("classify-cost error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
