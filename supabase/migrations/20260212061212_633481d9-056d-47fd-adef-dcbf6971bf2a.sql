
-- Fix security definer view by setting security_invoker
ALTER VIEW public.profiles_public SET (security_invoker = on);
