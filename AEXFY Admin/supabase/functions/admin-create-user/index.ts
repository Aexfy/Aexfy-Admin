import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const INVITE_REDIRECT_URL = Deno.env.get("INVITE_REDIRECT_URL") ?? "";
const OWNER_EMAILS = (Deno.env.get("OWNER_EMAILS") ?? "aexfytech@gmail.com,aexfytech@outlook.com,aexfytech@outlook.cl,aexfy.tech@outlook.cl")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);
const BOOTSTRAP_KEY = Deno.env.get("BOOTSTRAP_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bootstrap-key",
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

function getPrimaryRole(roles: string[]) {
  const order = [
    "ownaexfy",
    "gerente",
    "superadmin",
    "supervisor",
    "seller_manager",
    "vendedor",
    "seller",
    "instalador",
    "capacitador",
    "jefe_soporte",
    "soporte",
    "jefe_rrhh",
    "rrhh",
    "cliente",
    "client",
    "staff",
    "support",
    "developer"
  ];
  if (!roles.length) return "";
  let best = roles[0];
  let bestRank = order.indexOf(best);
  roles.forEach((role) => {
    const rank = order.indexOf(role);
    if (rank !== -1 && (bestRank === -1 || rank < bestRank)) {
      best = role;
      bestRank = rank;
    }
  });
  return best;
}

function getAllowedAssignments(roles: string[], isOwner: boolean) {
  const has = (role: string) => roles.includes(role);
  const allRoles = [
    "ownaexfy",
    "gerente",
    "jefe_soporte",
    "soporte",
    "jefe_rrhh",
    "rrhh",
    "supervisor",
    "instalador",
    "vendedor",
    "capacitador",
    "cliente"
  ];

  if (isOwner) return allRoles;
  if (has("gerente") || has("superadmin")) {
    return allRoles.filter((role) => role !== "ownaexfy" && role !== "gerente");
  }
  if (has("supervisor")) return ["instalador", "vendedor", "capacitador"];
  if (has("jefe_soporte") || has("soporte")) return ["soporte"];
  if (has("jefe_rrhh") || has("rrhh")) return ["rrhh"];
  return [];
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
  const bootstrapHeader = req.headers.get("x-bootstrap-key") ?? "";
  const bootstrapAllowed = BOOTSTRAP_KEY && bootstrapHeader && bootstrapHeader === BOOTSTRAP_KEY;

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let caller: any = null;
  if (token) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }
    caller = data.user;
  }

  if (!caller && !bootstrapAllowed) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch (_err) {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!email) {
    return jsonResponse({ error: "missing_email" }, 400);
  }

  const password = body.password ? String(body.password) : "";
  const requestedRoles = normalizeRoles(Array.isArray(body.roles) ? body.roles : []);
  const rolesToSet = requestedRoles.length ? requestedRoles : ["cliente"];
  const primaryRole = getPrimaryRole(rolesToSet);

  const metadata = {
    ...(body.metadata || {}),
    roles: rolesToSet,
    role: primaryRole,
    user_type: body.user_type || (body.metadata && body.metadata.user_type) || (rolesToSet.includes("cliente") ? "cliente" : "staff")
  };
  const redirectTo = String(body.redirectTo || "").trim() || INVITE_REDIRECT_URL;

  if (!caller && bootstrapAllowed) {
    if (!rolesToSet.includes("ownaexfy") || rolesToSet.length > 1) {
      return jsonResponse({ error: "bootstrap_only_owner" }, 403);
    }
  }

  if (caller) {
    const callerEmail = String(caller.email || "").toLowerCase();
    const callerRoles = normalizeRoles(
      Array.isArray(caller.user_metadata?.roles)
        ? caller.user_metadata.roles
        : caller.user_metadata?.role
          ? [caller.user_metadata.role]
          : []
    );
    const isOwner = callerRoles.includes("ownaexfy") || OWNER_EMAILS.includes(callerEmail);
    const allowed = getAllowedAssignments(callerRoles, isOwner);

    if (rolesToSet.includes("ownaexfy") && !isOwner) {
      return jsonResponse({ error: "forbidden", reason: "only_owner_can_create_owner" }, 403);
    }

    if (rolesToSet.includes("gerente") && !isOwner) {
      return jsonResponse({ error: "forbidden", reason: "only_owner_can_create_manager" }, 403);
    }

    const invalid = rolesToSet.filter((role) => !allowed.includes(role));
    if (invalid.length) {
      return jsonResponse({ error: "approval_required", roles: invalid }, 403);
    }
  }

  let result: any = null;
  let error: any = null;

  if (password) {
    const response = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata
    });
    result = response.data;
    error = response.error;
  } else {
    const response = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: metadata,
      redirectTo: redirectTo || undefined
    });
    result = response.data;
    error = response.error;
  }

  if (error) {
    const message = String(error.message || "");
    const alreadyExists = /already registered|already exists|duplicate/i.test(message);
    if (alreadyExists) {
      return jsonResponse({ user: null, invited: false, existing: true });
    }
    return jsonResponse({ error: "create_failed", message: error.message }, 400);
  }

  return jsonResponse({ user: result?.user || null, invited: !password });
});
