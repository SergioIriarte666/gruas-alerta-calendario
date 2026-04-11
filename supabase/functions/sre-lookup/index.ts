const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SRE_API_URL = "https://sre.cl/api/company_info";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("SRE_API_TOKEN");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "SRE_API_TOKEN no configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const rut = body?.rut?.trim();

    if (!rut || typeof rut !== "string" || rut.length < 3 || rut.length > 15) {
      return new Response(
        JSON.stringify({ error: "RUT inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Looking up RUT: ${rut}`);

    const sreResponse = await fetch(SRE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        rut,
        version: "2.0",
      }),
    });

    if (!sreResponse.ok) {
      console.error(`SRE API error: ${sreResponse.status}`);
      return new Response(
        JSON.stringify({ error: `Error de API SRE: ${sreResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await sreResponse.json();
    console.log("SRE response:", JSON.stringify(data));

    if (data.error || data.status === "error") {
      return new Response(
        JSON.stringify({ error: data.message || data.error || "RUT no encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = {
      razon_social: data.razon_social || data.nombre || "",
      direccion: data.direccion || "",
      comuna: data.comuna || "",
      telefono: data.telefono || "",
      email: data.email || data.dte_email || "",
      glosa_giro: data.glosa_giro || data.giro || "",
    };

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("sre-lookup error:", error);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
