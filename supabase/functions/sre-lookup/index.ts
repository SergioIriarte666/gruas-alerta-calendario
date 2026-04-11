const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SRE_API_URL = "https://sre.cl/api/company_info";
const RUTS_INFO_API_URL = "https://ruts.info/api/company-info";

function cleanRut(rut: string): string {
  return rut.replace(/\./g, "").replace(/-/g, "");
}

async function fetchFromRutsInfo(rut: string): Promise<Response> {
  const apiKey = Deno.env.get("RUTS_INFO_API_KEY");
  if (!apiKey) {
    throw new Error("RUTS_INFO_API_KEY not configured");
  }

  const cleanedRut = cleanRut(rut);
  console.log(`Falling back to ruts.info with RUT: ${cleanedRut}`);

  const response = await fetch(`${RUTS_INFO_API_URL}?rut=${cleanedRut}`, {
    method: "GET",
    headers: { "x-api-key": apiKey },
  });

  return response;
}

function mapRutsInfoResponse(data: any) {
  const firstAddress = data.addresses?.[0];
  const activities = data.activities || [];

  return {
    razon_social: data.business_name || "",
    rut: data.rut || "",
    dte_email: "",
    fecha_resolucion: "",
    numero_resolucion: null,
    actecos: activities.map((a: any) => a.activity_code).filter(Boolean),
    glosa_giro: activities.map((a: any) => a.activity_description).filter(Boolean).join(", "),
    es_mipyme: null,
    url: "",
    actualizado: "",
    direccion: firstAddress ? [firstAddress.street, firstAddress.street_number].filter(Boolean).join(" ") : "",
    comuna: firstAddress?.district || "",
    telefono: "",
    email: "",
    actividades_economicas: activities,
    _source: "ruts.info",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("SRE_API_TOKEN") || "token_publico";

    const body = await req.json();
    const rut = body?.rut?.trim();

    if (!rut || typeof rut !== "string" || rut.length < 3 || rut.length > 15) {
      return new Response(
        JSON.stringify({ error: "RUT inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Looking up RUT: ${rut} (token: ${token === "token_publico" ? "público" : "premium"})`);

    // Try SRE first
    let useFallback = false;
    let sreError = "";

    try {
      const sreResponse = await fetch(SRE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, rut }),
      });

      if (!sreResponse.ok) {
        const errorBody = await sreResponse.text().catch(() => "no body");
        console.error(`SRE API error: ${sreResponse.status} - ${errorBody}`);

        try {
          const parsed = JSON.parse(errorBody);
          if (parsed?.message?.includes("consultas disponibles") || parsed?.message?.includes("desactivado") || sreResponse.status === 403) {
            useFallback = true;
            sreError = parsed?.message || `HTTP ${sreResponse.status}`;
          }
        } catch {
          useFallback = true;
          sreError = `HTTP ${sreResponse.status}`;
        }

        if (!useFallback) {
          return new Response(
            JSON.stringify({ error: `Error de API SRE (${sreResponse.status})` }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        const data = await sreResponse.json();
        console.log("SRE response:", JSON.stringify(data));

        if (data.error) {
          useFallback = true;
          sreError = data.error;
        } else {
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
            direccion: data.direccion || "",
            comuna: data.comuna || "",
            telefono: data.telefono || "",
            email: data.email || "",
            actividades_economicas: data.actividades_economicas || [],
            _source: "sre.cl",
          };

          // If SRE succeeded but missing address/phone (free tier), enrich from ruts.info
          const missingAddress = !result.direccion && !result.comuna;
          const missingContact = !result.telefono && !result.email;
          
          if (missingAddress || missingContact) {
            console.log("SRE missing address/contact data, enriching from ruts.info...");
            try {
              const enrichResponse = await fetchFromRutsInfo(rut);
              if (enrichResponse.ok) {
                const enrichData = await enrichResponse.json();
                console.log("ruts.info enrich response:", JSON.stringify(enrichData));
                
                if (!enrichData.error) {
                  const mapped = mapRutsInfoResponse(enrichData);
                  if (missingAddress) {
                    result.direccion = mapped.direccion;
                    result.comuna = mapped.comuna;
                  }
                  if (missingContact) {
                    // Keep SRE data priority, only fill blanks
                    if (!result.telefono && mapped.telefono) result.telefono = mapped.telefono;
                    if (!result.email && mapped.email) result.email = mapped.email;
                  }
                  if (!result.glosa_giro && mapped.glosa_giro) {
                    result.glosa_giro = mapped.glosa_giro;
                  }
                  if (result.actividades_economicas.length === 0 && mapped.actividades_economicas.length > 0) {
                    result.actividades_economicas = mapped.actividades_economicas;
                  }
                  result._source = "sre.cl + ruts.info";
                }
              } else {
                const errText = await enrichResponse.text().catch(() => "");
                console.log("ruts.info enrich failed:", errText);
              }
            } catch (enrichErr) {
              console.log("ruts.info enrich error (non-fatal):", enrichErr.message);
            }
          }

          return new Response(
            JSON.stringify(result),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } catch (e) {
      console.error("SRE fetch error:", e);
      useFallback = true;
      sreError = e.message || "SRE connection error";
    }

    // Fallback to ruts.info
    if (useFallback) {
      console.log(`SRE failed (${sreError}), trying ruts.info fallback...`);

      try {
        const rutsResponse = await fetchFromRutsInfo(rut);

        if (!rutsResponse.ok) {
          const errText = await rutsResponse.text().catch(() => "no body");
          console.error(`ruts.info error: ${rutsResponse.status} - ${errText}`);
          return new Response(
            JSON.stringify({ error: `Ambas fuentes fallaron. SRE: ${sreError}. ruts.info: HTTP ${rutsResponse.status}` }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const rutsData = await rutsResponse.json();
        console.log("ruts.info response:", JSON.stringify(rutsData));

        if (rutsData.error) {
          return new Response(
            JSON.stringify({ error: rutsData.error }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const result = mapRutsInfoResponse(rutsData);
        return new Response(
          JSON.stringify(result),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (fallbackError) {
        console.error("ruts.info fallback error:", fallbackError);
        return new Response(
          JSON.stringify({ error: `SRE: ${sreError}. ruts.info: ${fallbackError.message}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Error inesperado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("sre-lookup error:", error);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
