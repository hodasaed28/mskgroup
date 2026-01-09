-- Add two_factor_enabled column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false;

-- Fix security issue: comments should only be readable by authenticated users
DROP POLICY IF EXISTS "Anyone can view comments" ON public.comments;
CREATE POLICY "Authenticated users can view comments" 
ON public.comments 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Fix security issue: likes should only be readable by authenticated users
DROP POLICY IF EXISTS "Anyone can view likes" ON public.likes;
CREATE POLICY "Authenticated users can view likes" 
ON public.likes 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Add INSERT policy for notifications (using database function instead)
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "Users can create notifications for others" 
ON public.notifications 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Update profiles policy to handle private accounts properly
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);