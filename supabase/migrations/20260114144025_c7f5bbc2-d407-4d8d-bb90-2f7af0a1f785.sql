-- Add online status and last_seen columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone DEFAULT now();

-- Create typing indicators table
CREATE TABLE IF NOT EXISTS public.typing_indicators (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  chat_with_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_typing boolean DEFAULT false,
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, chat_with_id)
);

-- Enable RLS on typing_indicators
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

-- RLS policies for typing_indicators
CREATE POLICY "Users can see typing status of their chats"
ON public.typing_indicators
FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = chat_with_id);

CREATE POLICY "Users can update their typing status"
ON public.typing_indicators
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own typing status"
ON public.typing_indicators
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own typing status"
ON public.typing_indicators
FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for typing_indicators
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_typing_indicators_chat ON public.typing_indicators(chat_with_id, user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_online ON public.profiles(is_online) WHERE is_online = true;