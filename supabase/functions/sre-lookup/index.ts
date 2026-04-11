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
    const envToken = Deno.env.get("SRE_API_TOKEN");
    const token = envToken || "token_publico";
    const isPublicToken = token === "token_publico";

    const body = await req.json();
    const rut = body?.rut?.trim();

    if (!rut || typeof rut !== "string" || rut.length < 3 || rut.length > 15) {
      return new Response(
        JSON.stringify({ error: "RUT inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Looking up RUT: ${rut} (token: ${isPublicToken ? "público" : "premium"})`);

    const sreResponse = await fetch(SRE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, rut }),
    });

    if (!sreResponse.ok) {
      const errorBody = await sreResponse.text().catch(() => "no body");
      console.error(`SRE API error: ${sreResponse.status} - ${errorBody}`);
      return new Response(
        JSON.stringify({ error: `Error de API SRE: ${sreResponse.status}`, details: errorBody }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await sreResponse.json();
    console.log("SRE response:", JSON.stringify(data));

    if (data.error) {
      return new Response(
        JSON.stringify({ error: data.error }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = {
      razon_social: data.razon_social || "",
      rut: data.rut || "",
      dte_email: data.dte_email || "",
      fecha_resolucion: data.fecha_resol || "",
      numero_resolucion: data.numero_resol || null,
      actecos: data.actecos || [],
      glosa_giro: data.glosa_giro || "",
      es_mipyme: data.es_mipyme ?? null,
      url: data.url || "",
      actualizado: data.actualizado || "",
      // Premium fields (available with paid token)
      direccion: data.direccion || "",
      comuna: data.comuna || "",
      telefono: data.telefono || "",
      email: data.email || "",
      actividades_economicas: data.actividades_economicas || [],
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
