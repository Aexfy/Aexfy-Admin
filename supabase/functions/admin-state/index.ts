import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const STATE_TABLE = Deno.env.get("STATE_TABLE") ?? "aexfy_admin_state";
const STATE_ROW_ID = Deno.env.get("STATE_ROW_ID") ?? "main";
const OWNER_EMAILS = (Deno.env.get("OWNER_EMAILS") ??
  "aexfytech@gmail.com,aexfytech@outlook.com,aexfytech@outlook.cl,aexfy.tech@outlook.cl")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function normalizeRoles(roles: string[]) {
  return roles
    .map((role) => String(role || "").trim().toLowerCase())
    .filter(Boolean);
}

function getUserRoles(user: any) {
  const meta = user?.user_metadata ?? {};
  if (Array.isArray(meta.roles)) return normalizeRoles(meta.roles);
  if (meta.role) return normalizeRoles([meta.role]);
  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: "missing_env" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer", "").trim();
  if (!token) {
    return jsonResponse({ error: "missing_token" }, 401);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const user = data.user;
  const roles = getUserRoles(user);
  const email = String(user.email || "").toLowerCase();
  const userType = String(user.user_metadata?.user_type || "").toLowerCase();
  const isOwner = roles.includes("ownaexfy") || OWNER_EMAILS.includes(email);
  const isClient = userType === "cliente" || roles.includes("cliente") || roles.includes("client");

  if (!isOwner && isClient) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  if (req.method === "GET") {
    const { data: rows, error: readError } = await supabaseAdmin
      .from(STATE_TABLE)
      .select("id, type, companies, users, meta")
      .in("id", [STATE_ROW_ID, "__meta__"]);

    if (readError) {
      return jsonResponse({ error: "state_read_failed", message: readError.message }, 400);
    }

    const mainRow = rows?.find((row: any) => row.id === STATE_ROW_ID);
    const metaRow = rows?.find((row: any) => row.id === "__meta__" && row.type === "meta");

    if (!mainRow) {
      return jsonResponse({ error: "missing_state_row" }, 404);
    }

    return jsonResponse({
      companies: Array.isArray(mainRow.companies) ? mainRow.companies : [],
      users: Array.isArray(mainRow.users) ? mainRow.users : [],
      meta: metaRow?.meta || {}
    });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch (_err) {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const companies = Array.isArray(body.companies) ? body.companies : [];
  const users = Array.isArray(body.users) ? body.users : [];
  const meta = body.meta && typeof body.meta === "object" ? body.meta : {};
  const now = new Date().toISOString();

  const { error: updateMainError } = await supabaseAdmin
    .from(STATE_TABLE)
    .upsert({
      id: STATE_ROW_ID,
      companies,
      users,
      updated_at: now
    }, { onConflict: "id" });

  if (updateMainError) {
    return jsonResponse({ error: "state_save_failed", message: updateMainError.message }, 400);
  }

  const { error: updateMetaError } = await supabaseAdmin
    .from(STATE_TABLE)
    .upsert({
      id: "__meta__",
      type: "meta",
      meta,
      updated_at: now
    }, { onConflict: "id" });

  if (updateMetaError) {
    return jsonResponse({ error: "state_save_failed", message: updateMetaError.message }, 400);
  }

  return jsonResponse({ ok: true });
});
