import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OWNER_EMAILS = (Deno.env.get("OWNER_EMAILS") ??
  "aexfytech@gmail.com,aexfytech@outlook.com,aexfytech@outlook.cl,aexfy.tech@outlook.cl")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS"
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function findUserIdByEmail(email: string) {
  if (!email) return "";
  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: "auth" }
  });
  const { data, error } = await supabaseAuth
    .from("users")
    .select("id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  if (error || !data?.id) return "";
  return String(data.id);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
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

  const caller = data.user;
  const callerEmail = String(caller.email || "").toLowerCase();
  const roles = getUserRoles(caller);
  const isOwner = roles.includes("ownaexfy") || OWNER_EMAILS.includes(callerEmail);
  const isManager = roles.includes("gerente") || roles.includes("superadmin");

  if (!isOwner && !isManager) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch (_err) {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const userIdInput = String(body.user_id || body.userId || "").trim();
  const userEmail = String(body.user_email || body.email || "").trim().toLowerCase();
  let userId = userIdInput;
  if ((!userId || !isUuid(userId)) && userEmail) {
    userId = await findUserIdByEmail(userEmail);
  }
  if (!userId) {
    return jsonResponse({ error: "missing_user_id" }, 400);
  }

  const action = String(body.action || "delete").trim().toLowerCase();
  const adminAuth: any = supabaseAdmin.auth.admin;

  if (typeof adminAuth.signOut === "function") {
    try {
      await adminAuth.signOut(userId);
    } catch (_err) {
      // Ignore sign out failures.
    }
  }

  if (action === "disable") {
    const duration = String(body.ban_duration || "87600h");
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: duration
    });
    if (updateError) {
      return jsonResponse({ error: "disable_failed", message: updateError.message }, 400);
    }
    return jsonResponse({ ok: true, disabled: true });
  }

  if (action !== "delete") {
    return jsonResponse({ error: "invalid_action" }, 400);
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteError) {
    const message = String(deleteError.message || "");
    if (/not found/i.test(message)) {
      return jsonResponse({ ok: true, not_found: true });
    }
    return jsonResponse({ error: "delete_failed", message: deleteError.message }, 400);
  }

  return jsonResponse({ ok: true });
});
