import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Chilean license plate patterns: 4 letters + 2 digits (new) or 2 letters + 4 digits (old)
const PATENT_REGEX = /\b([A-Z]{4}\d{2}|[A-Z]{2}\d{4}|[A-Z]{2}[A-Z]{2}\d{2})\b/g;
const OC_NUMBER_REGEX = /(?:N[°º]\s*(?:de\s*)?OC|Orden\s*(?:de\s*)?Compra|Purchase\s*Order|OC\s*N[°º]?|N[°º]\s*Orden)[:\s]*(\d{5,})/i;
const OC_NUMBER_FALLBACK = /\b(\d{10})\b/; // 10-digit number as fallback (SAP style)
const DATE_REGEX = /(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})/;
const AMOUNT_REGEX = /\$?\s*([\d.,]+)/g;

interface ParsedItem {
  patente: string;
  detail: string;
  amount: number;
}

interface ParsedOC {
  ocNumber: string;
  date: string | null;
  items: ParsedItem[];
  totals: {
    neto: number;
    iva: number;
    total: number;
  };
  rawText: string;
}

function extractTextFromPDFBytes(bytes: Uint8Array): string {
  // Simple PDF text extraction - looks for text between BT/ET markers and parentheses
  const decoder = new TextDecoder('latin1');
  const content = decoder.decode(bytes);
  
  const textParts: string[] = [];
  
  // Extract text from PDF streams - look for text in parentheses within BT...ET blocks
  // Also handle hex strings <...>
  const streamRegex = /stream\s*\n([\s\S]*?)endstream/g;
  let streamMatch;
  
  while ((streamMatch = streamRegex.exec(content)) !== null) {
    const stream = streamMatch[1];
    
    // Extract text from Tj and TJ operators
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(stream)) !== null) {
      textParts.push(tjMatch[1]);
    }
    
    // Extract from TJ arrays
    const tjArrayRegex = /\[((?:[^]]*?))\]\s*TJ/g;
    let tjArrayMatch;
    while ((tjArrayMatch = tjArrayRegex.exec(stream)) !== null) {
      const arrayContent = tjArrayMatch[1];
      const stringRegex = /\(([^)]*)\)/g;
      let strMatch;
      while ((strMatch = stringRegex.exec(arrayContent)) !== null) {
        textParts.push(strMatch[1]);
      }
    }
  }
  
  // Also try direct text extraction for simpler PDFs
  const directTextRegex = /\(([^)]{2,})\)/g;
  let directMatch;
  while ((directMatch = directTextRegex.exec(content)) !== null) {
    const text = directMatch[1];
    // Filter out binary/control sequences
    if (/^[\x20-\x7E\xA0-\xFF]+$/.test(text) && text.length > 1) {
      textParts.push(text);
    }
  }
  
  return textParts.join(' ');
}

function parseOCFromText(text: string): ParsedOC {
  // Extract OC number
  let ocNumber = '';
  const ocMatch = text.match(OC_NUMBER_REGEX);
  if (ocMatch) {
    ocNumber = ocMatch[1];
  } else {
    // Fallback: look for 10-digit numbers
    const fallbackMatch = text.match(OC_NUMBER_FALLBACK);
    if (fallbackMatch) {
      ocNumber = fallbackMatch[1];
    }
  }
  
  // Extract date
  let date: string | null = null;
  const dateMatch = text.match(DATE_REGEX);
  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    date = `${year}-${month}-${day}`;
  }
  
  // Extract license plates (patentes)
  const patentes = new Set<string>();
  let patentMatch;
  const cleanText = text.toUpperCase();
  while ((patentMatch = PATENT_REGEX.exec(cleanText)) !== null) {
    const candidate = patentMatch[1];
    // Filter out common false positives
    if (!['CORREO', 'NOMBRE', 'CIUDAD'].some(fp => candidate.includes(fp))) {
      patentes.add(candidate);
    }
  }
  
  // Build items from patentes found
  const items: ParsedItem[] = Array.from(patentes).map(patente => ({
    patente,
    detail: 'Extraído del PDF',
    amount: 0,
  }));
  
  // Try to extract total amounts
  let neto = 0, iva = 0, total = 0;
  const netoMatch = text.match(/(?:Neto|Sub\s*total|Monto\s*Neto)[:\s]*\$?\s*([\d.,]+)/i);
  const ivaMatch = text.match(/(?:IVA|I\.V\.A\.?)[:\s]*\$?\s*([\d.,]+)/i);
  const totalMatch = text.match(/(?:Total|Monto\s*Total)[:\s]*\$?\s*([\d.,]+)/i);
  
  const parseAmount = (str: string): number => {
    return parseInt(str.replace(/[.,]/g, ''), 10) || 0;
  };
  
  if (netoMatch) neto = parseAmount(netoMatch[1]);
  if (ivaMatch) iva = parseAmount(ivaMatch[1]);
  if (totalMatch) total = parseAmount(totalMatch[1]);
  
  return {
    ocNumber,
    date,
    items,
    totals: { neto, iva, total },
    rawText: text.substring(0, 2000), // Return first 2000 chars for debugging
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const body = await req.json();
    const { pdfBase64 } = body;
    
    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ error: 'Se requiere el PDF en base64' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Decode base64 to bytes
    const binaryString = atob(pdfBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Extract text from PDF
    const extractedText = extractTextFromPDFBytes(bytes);
    
    console.log('Extracted text length:', extractedText.length);
    console.log('Extracted text preview:', extractedText.substring(0, 500));
    
    // Parse the extracted text
    const parsed = parseOCFromText(extractedText);
    
    console.log('Parsed OC:', JSON.stringify({ 
      ocNumber: parsed.ocNumber, 
      itemCount: parsed.items.length,
      patentes: parsed.items.map(i => i.patente)
    }));
    
    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error processing PDF:', error);
    return new Response(
      JSON.stringify({ error: `Error procesando PDF: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
