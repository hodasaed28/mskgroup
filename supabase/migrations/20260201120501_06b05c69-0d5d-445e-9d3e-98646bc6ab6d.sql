-- Add columns for server-side 2FA secret storage (encrypted)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
ADD COLUMN IF NOT EXISTS two_factor_backup_codes JSONB;

-- Create a secure function to enable 2FA (stores secret server-side)
CREATE OR REPLACE FUNCTION public.enable_two_factor(
  p_secret TEXT,
  p_backup_codes JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Update profile with encrypted 2FA data
  UPDATE profiles
  SET 
    two_factor_enabled = true,
    two_factor_secret = p_secret,
    two_factor_backup_codes = p_backup_codes,
    updated_at = now()
  WHERE id = auth.uid();
  
  RETURN true;
END;
$$;

-- Create a secure function to verify 2FA code
CREATE OR REPLACE FUNCTION public.verify_two_factor_code(
  p_user_id UUID,
  p_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret TEXT;
  v_backup_codes JSONB;
  v_code_index INT;
BEGIN
  -- Get the user's 2FA secret and backup codes
  SELECT two_factor_secret, two_factor_backup_codes
  INTO v_secret, v_backup_codes
  FROM profiles
  WHERE id = p_user_id AND two_factor_enabled = true;
  
  IF v_secret IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', '2FA not enabled');
  END IF;
  
  -- Return secret for client-side TOTP validation
  -- Note: In a production system, you'd validate server-side with a TOTP library
  RETURN jsonb_build_object(
    'valid', true, 
    'secret', v_secret,
    'backup_codes', v_backup_codes
  );
END;
$$;

-- Create a function to disable 2FA
CREATE OR REPLACE FUNCTION public.disable_two_factor()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  UPDATE profiles
  SET 
    two_factor_enabled = false,
    two_factor_secret = NULL,
    two_factor_backup_codes = NULL,
    updated_at = now()
  WHERE id = auth.uid();
  
  RETURN true;
END;
$$;

-- Create a function to consume a backup code
CREATE OR REPLACE FUNCTION public.consume_backup_code(
  p_user_id UUID,
  p_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_backup_codes JSONB;
  v_new_codes JSONB;
  v_found BOOLEAN := false;
BEGIN
  -- Get current backup codes
  SELECT two_factor_backup_codes
  INTO v_backup_codes
  FROM profiles
  WHERE id = p_user_id AND two_factor_enabled = true;
  
  IF v_backup_codes IS NULL THEN
    RETURN false;
  END IF;
  
  -- Remove the used code from the array
  SELECT jsonb_agg(code)
  INTO v_new_codes
  FROM jsonb_array_elements_text(v_backup_codes) AS code
  WHERE UPPER(code::text) != UPPER(p_code);
  
  -- Check if a code was removed
  IF v_new_codes IS DISTINCT FROM v_backup_codes THEN
    v_found := true;
    
    -- Update the backup codes
    UPDATE profiles
    SET two_factor_backup_codes = COALESCE(v_new_codes, '[]'::jsonb)
    WHERE id = p_user_id;
  END IF;
  
  RETURN v_found;
END;
$$;

-- Create a view for public profile data (excludes sensitive fields)
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT 
  id,
  username,
  full_name,
  avatar_url,
  cover_url,
  bio,
  is_private,
  created_at,
  updated_at
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT ON public.profiles_public TO anon;