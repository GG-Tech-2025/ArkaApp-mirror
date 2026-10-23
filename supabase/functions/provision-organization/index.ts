// provision-organization: onboard a new client organization (platform super-admins only).
//
// 1. Check the caller's token is valid and the caller is a super-admin (read live from
//    `profiles`: flagged, and belonging to no organization).
// 2. Create the first admin's login with a generated temporary password.
// 3. Call the service-role-only `provision_organization` database function, which creates
//    the org, branch, profile, access and branch defaults in one transaction.
// 4. If step 3 fails, delete the login again so nothing is left behind.
//
// The temporary password is returned once, in the response, and is never logged or stored.

import { createClient } from "npm:@supabase/supabase-js@2.89.0";
import { generateTemporaryPassword, validateInput } from "./validate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Use POST" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(500, { error: "Server is not configured" });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // --- 1. who is calling? -------------------------------------------------
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Sign in first" });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json(401, { error: "Your session is not valid. Sign in again" });
  const caller = userData.user;

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("is_super_admin, organization_id")
    .eq("id", caller.id)
    .maybeSingle();
  if (profileError) return json(500, { error: "Could not check your permissions" });
  if (!profile || profile.is_super_admin !== true || profile.organization_id !== null) {
    return json(403, { error: "Only platform administrators can create organizations" });
  }

  // --- 2. what are we creating? ------------------------------------------
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Request body must be valid JSON" });
  }
  const checked = validateInput(body);
  if (!checked.ok) return json(400, { error: checked.error });
  const input = checked.value;

  // --- 3. the admin's login ----------------------------------------------
  const temporaryPassword = generateTemporaryPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.adminEmail,
    password: temporaryPassword,
    email_confirm: true,
  });
  if (createError || !created.user) {
    if (createError?.code === "email_exists") {
      return json(409, { error: "A login with that email already exists" });
    }
    console.error("createUser failed:", createError?.code, createError?.message);
    return json(500, { error: "Could not create the admin's login" });
  }
  const adminUserId = created.user.id;

  // --- 4. everything else, in one database transaction --------------------
  const { data: result, error: rpcError } = await admin.rpc("provision_organization", {
    p_name: input.organizationName,
    p_slug: input.slug,
    p_branch_name: input.branchName,
    p_branch_code: input.branchCode,
    p_admin_user_id: adminUserId,
    p_admin_phone: input.adminPhone,
    p_contact_email: input.contactEmail,
    p_plan: input.plan,
    p_trial_days: input.trialDays,
  });

  if (rpcError) {
    // Undo the login so a failed attempt leaves nothing behind.
    const { error: deleteError } = await admin.auth.admin.deleteUser(adminUserId);
    if (deleteError) console.error("ORPHANED LOGIN, delete it by hand:", adminUserId, deleteError.message);

    const detail = `${rpcError.message ?? ""} ${rpcError.details ?? ""}`;
    if (rpcError.code === "23505") {
      if (detail.includes("organizations_slug_key")) return json(409, { error: "That organization slug is already taken" });
      if (detail.includes("profiles_phone_key")) return json(409, { error: "That phone number is already used by another user" });
      if (detail.includes("branches_org_code_key")) return json(409, { error: "That branch code is already used" });
      return json(409, { error: "Something with those details already exists" });
    }
    if (rpcError.code === "22023") return json(400, { error: rpcError.message });
    console.error("provision_organization failed:", rpcError.code, rpcError.message);
    return json(500, { error: "Could not create the organization" });
  }

  console.log(`provisioned organization ${result?.organization_id} for admin ${adminUserId} by ${caller.id}`);
  return json(201, {
    organizationId: result.organization_id,
    branchId: result.branch_id,
    adminEmail: input.adminEmail,
    temporaryPassword,
  });
});
