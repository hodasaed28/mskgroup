import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import * as OTPAuth from "https://esm.sh/otpauth@9.4.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, code, email } = await req.json();

    if (!user_id || !code || !email) {
      return new Response(
        JSON.stringify({ valid: false, error: "Missing required parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to access sensitive data
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get the user's 2FA secret and backup codes from database
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("two_factor_secret, two_factor_backup_codes, two_factor_enabled")
      .eq("id", user_id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ valid: false, error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile.two_factor_enabled || !profile.two_factor_secret) {
      return new Response(
        JSON.stringify({ valid: false, error: "2FA not enabled for this user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let isValid = false;
    let isBackupCode = false;

    // First try TOTP verification
    try {
      const totp = new OTPAuth.TOTP({
        issuer: "MSK Group",
        label: email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(profile.two_factor_secret),
      });

      const delta = totp.validate({ token: code, window: 1 });
      isValid = delta !== null;
    } catch (totpError) {
      console.error("TOTP validation error:", totpError);
    }

    // If TOTP fails, check backup codes
    if (!isValid && profile.two_factor_backup_codes) {
      const backupCodes: string[] = Array.isArray(profile.two_factor_backup_codes)
        ? profile.two_factor_backup_codes
        : JSON.parse(profile.two_factor_backup_codes);

      const codeIndex = backupCodes.findIndex(
        (backupCode) => backupCode.toUpperCase() === code.toUpperCase()
      );

      if (codeIndex !== -1) {
        isValid = true;
        isBackupCode = true;

        // Remove the used backup code
        const newBackupCodes = [...backupCodes];
        newBackupCodes.splice(codeIndex, 1);

        await supabaseAdmin
          .from("profiles")
          .update({ two_factor_backup_codes: newBackupCodes })
          .eq("id", user_id);
      }
    }

    return new Response(
      JSON.stringify({
        valid: isValid,
        is_backup_code: isBackupCode,
        backup_codes_remaining: isBackupCode
          ? (Array.isArray(profile.two_factor_backup_codes)
              ? profile.two_factor_backup_codes.length - 1
              : JSON.parse(profile.two_factor_backup_codes).length - 1)
          : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in verify-2fa:", error);
    return new Response(
      JSON.stringify({ valid: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
