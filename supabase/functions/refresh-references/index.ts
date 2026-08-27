import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://pbolig.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Listing = { price_ars: number; url: string };
type Result = { source: string; status: string; count?: number; prices?: number[]; message?: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) return JSON.stringify(error);
  return String(error);
}

function parsePrice(value: string) {
  const match = value.match(/\d[\d.]*/);
  return match ? Number(match[0].replaceAll(".", "")) : null;
}

async function mercadoLibre(query: string): Promise<Listing[]> {
  let token = Deno.env.get("MELI_ACCESS_TOKEN");
  const clientId = Deno.env.get("MELI_CLIENT_ID");
  const clientSecret = Deno.env.get("MELI_CLIENT_SECRET");
  const refreshToken = Deno.env.get("MELI_REFRESH_TOKEN");

  let tokenStatus = "";
  if (clientId && clientSecret && refreshToken) {
    try {
      const tokenResponse = await fetch("https://api.mercadolibre.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken
        })
      });
      if (tokenResponse.ok) {
        token = (await tokenResponse.json()).access_token;
        tokenStatus = "refresh_token OK";
      } else {
        const errText = await tokenResponse.text();
        tokenStatus = `refresh_token failed (HTTP ${tokenResponse.status}: ${errText})`;
      }
    } catch (e) {
      tokenStatus = `Error fetching token: ${e instanceof Error ? e.message : String(e)}`;
    }
  } else if (token) {
    tokenStatus = "MELI_ACCESS_TOKEN configured";
  } else {
    tokenStatus = `Missing user token (clientId: ${!!clientId}, clientSecret: ${!!clientSecret}, refreshToken: ${!!refreshToken}, accessToken: ${!!token})`;
  }

  if (!token) throw new Error(`Mercado Libre: falta un access token de usuario (${tokenStatus})`);
  const userResponse = await fetch("https://api.mercadolibre.com/users/me", {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!userResponse.ok) {
    const userError = await userResponse.text();
    throw new Error(`Mercado Libre: el access token no permite /users/me (HTTP ${userResponse.status}: ${userError}; ${tokenStatus})`);
  }

  const response = await fetch(`https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(query)}&limit=3`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Mercado Libre: HTTP ${response.status} - ${errText} (Token válido en /users/me; ${tokenStatus}; revisar IP permitida, scopes y estado de la aplicación)`);
  }
  const data = await response.json();
  return (data.results || []).map((item: { price: number; permalink: string }) => ({ price_ars: item.price, url: item.permalink }));
}

async function rosarioGarage(query: string): Promise<Listing[]> {
  const isMoto = /moto|himalayan|enfield|honda|yamaha|kawasaki|suzuki|ktm|benelli/i.test(query);
  const response = await fetch(`https://www.rosariogarage.com/${isMoto ? "Motos" : "Autos"}`, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`Rosario Garage: HTTP ${response.status}`);
  const html = await response.text();
  const cards = [...html.matchAll(/box_aviso(?:_premium)?_base[\s\S]{0,12000}?class=["']list_type_anuncio[^>]*>\s*([^<]+)\s*<\/span>[\s\S]{0,12000}?class=["']precio[^>]*[\s\S]*?<a[^>]*>\s*([^<]+)\s*<\/a>/gi)];
  const tokens = query.toLowerCase().split(/\s+/).filter((token) => token.length > 2);
  return cards.map((card) => ({ title: card[1], price_ars: parsePrice(card[2]), url: `https://www.rosariogarage.com/${isMoto ? "Motos" : "Autos"}` })).filter((item) => item.price_ars && tokens.some((token) => item.title.toLowerCase().includes(token))).slice(0, 3).map((item) => ({ price_ars: item.price_ars!, url: item.url }));
}

async function refreshSource(admin: ReturnType<typeof createClient>, vehicleId: number, source: string, label: string, fetcher: () => Promise<Listing[]>): Promise<Result> {
  try {
    const listings = await fetcher();
    if (!listings.length) return { source, status: "no_results", count: 0, prices: [] };
    const { data: inserted, error: insertError } = await admin.from("price_references").insert(listings.map((listing) => ({ ...listing, vehicle_id: vehicleId, source, source_label: label }))).select("id");
    if (insertError) throw insertError;
    const insertedIds = (inserted || []).map((row) => row.id);
    const { error: deleteError } = await admin.from("price_references").delete().eq("vehicle_id", vehicleId).eq("source", source).not("id", "in", `(${insertedIds.join(",")})`);
    if (deleteError) throw deleteError;
    return { source, status: listings.length ? "ok" : "no_results", count: listings.length, prices: listings.map((listing) => listing.price_ars) };
  } catch (error) {
    return { source, status: "error", message: errorMessage(error) };
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método no permitido" }, 405);
  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Autenticación requerida" }, 401);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: "Sesión inválida" }, 401);
  const body = await request.json();
  const vehicleId = Number(body.vehicle_id);
  if (!Number.isInteger(vehicleId)) return json({ error: "vehicle_id inválido" }, 400);
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: vehicle, error: vehicleError } = await admin.from("vehicles").select("id, brand, model, year").eq("id", vehicleId).single();
  if (vehicleError || !vehicle) return json({ error: "Vehículo no encontrado" }, 404);
  const query = `${vehicle.brand} ${vehicle.model} ${vehicle.year}`;
  const results = [await refreshSource(admin, vehicleId, "mercadolibre", "Mercado Libre", () => mercadoLibre(query)), await refreshSource(admin, vehicleId, "rosario_garage", "Rosario Garage", () => rosarioGarage(query))];
  return json({ vehicle_id: vehicleId, query, results });
});
