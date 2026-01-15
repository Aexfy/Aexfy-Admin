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

function resolveAuthStatus(user: any) {
  const metaStatus = String(user?.user_metadata?.status || "").trim().toLowerCase();
  if (metaStatus) return metaStatus;
  const bannedUntil = user?.banned_until || user?.bannedUntil || user?.ban_expires_at;
  if (bannedUntil) {
    const until = new Date(bannedUntil);
    if (!Number.isNaN(until.getTime()) && until.getTime() > Date.now()) {
      return "disabled";
    }
  }
  return "active";
}

function mapAuthUser(user: any) {
  const meta = user?.user_metadata ? { ...user.user_metadata } : {};
  const roles = getUserRoles(user);
  if (!meta.user_type) {
    meta.user_type = roles.includes("cliente") || roles.includes("client") ? "cliente" : "staff";
  }
  if (!Array.isArray(meta.roles) && roles.length) {
    meta.roles = roles;
  }
  if (!meta.role && roles.length) {
    meta.role = roles[0];
  }
  return {
    id: user?.id || "",
    auth_id: user?.id || "",
    email: user?.email || "",
    status: resolveAuthStatus(user),
    user_metadata: meta,
    created_at: user?.created_at || null,
    updated_at: user?.updated_at || user?.created_at || null
  };
}

async function listAllAuthUsers(supabaseAdmin: any) {
  const users: any[] = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = Array.isArray(data?.users) ? data.users : [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }

  return users;
}

function mergeUsers(stateUsers: any[], authUsers: any[]) {
  const merged = Array.isArray(stateUsers) ? stateUsers.map((item) => ({ ...item })) : [];
  const byId = new Map<string, number>();
  const byEmail = new Map<string, number>();

  merged.forEach((user: any, index: number) => {
    if (user?.auth_id) byId.set(String(user.auth_id), index);
    if (user?.id) byId.set(String(user.id), index);
    const email = String(user?.email || "").toLowerCase();
    if (email) byEmail.set(email, index);
  });

  let changed = false;

  authUsers.forEach((authUser: any) => {
    const email = String(authUser?.email || "").toLowerCase();
    const authId = String(authUser?.id || "");
    const normalized = mapAuthUser(authUser);
    const existingIndex = (authId && byId.has(authId))
      ? byId.get(authId)
      : (email ? byEmail.get(email) : undefined);

    if (existingIndex === undefined || existingIndex === null) {
      merged.push(normalized);
      const newIndex = merged.length - 1;
      if (authId) byId.set(authId, newIndex);
      if (email) byEmail.set(email, newIndex);
      changed = true;
      return;
    }

    const existing = merged[existingIndex] || {};
    const next = { ...existing };
    if (!next.auth_id && authId) {
      next.auth_id = authId;
      changed = true;
    }
    if (!next.email && normalized.email) {
      next.email = normalized.email;
      changed = true;
    }
    const mergedMeta = { ...(normalized.user_metadata || {}), ...(next.user_metadata || {}) };
    if (JSON.stringify(mergedMeta) !== JSON.stringify(next.user_metadata || {})) {
      next.user_metadata = mergedMeta;
      changed = true;
    }
    if (!next.status && normalized.status) {
      next.status = normalized.status;
      changed = true;
    }
    if (normalized.status === "disabled" && next.status !== "disabled") {
      next.status = "disabled";
      changed = true;
    }
    if (!next.created_at && normalized.created_at) {
      next.created_at = normalized.created_at;
      changed = true;
    }
    if (!next.updated_at && normalized.updated_at) {
      next.updated_at = normalized.updated_at;
      changed = true;
    }
    merged[existingIndex] = next;
  });

  return { merged, changed };
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
  const isManager = roles.includes("gerente") || roles.includes("superadmin");
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

    const companies = Array.isArray(mainRow?.companies) ? mainRow.companies : [];
    const stateUsers = Array.isArray(mainRow?.users) ? mainRow.users : [];
    const meta = metaRow?.meta || {};
    const now = new Date().toISOString();

    let users = stateUsers;
    let mainRowCreated = false;
    let metaRowCreated = !!metaRow;

    if (isOwner || isManager) {
      try {
        const authUsers = await listAllAuthUsers(supabaseAdmin);
        const merged = mergeUsers(stateUsers, authUsers);
        users = merged.merged;
        if (merged.changed || !mainRow) {
          await supabaseAdmin.from(STATE_TABLE).upsert({
            id: STATE_ROW_ID,
            companies,
            users,
            updated_at: now
          }, { onConflict: "id" });
          mainRowCreated = true;
        }
        if (!metaRow) {
          await supabaseAdmin.from(STATE_TABLE).upsert({
            id: "__meta__",
            type: "meta",
            meta,
            updated_at: now
          }, { onConflict: "id" });
          metaRowCreated = true;
        }
      } catch (_err) {
        users = stateUsers;
      }
    }

    if (!mainRow && !mainRowCreated) {
      await supabaseAdmin.from(STATE_TABLE).upsert({
        id: STATE_ROW_ID,
        companies,
        users,
        updated_at: now
      }, { onConflict: "id" });
    }
    if (!metaRowCreated) {
      await supabaseAdmin.from(STATE_TABLE).upsert({
        id: "__meta__",
        type: "meta",
        meta,
        updated_at: now
      }, { onConflict: "id" });
    }

    return jsonResponse({
      companies,
      users,
      meta
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
