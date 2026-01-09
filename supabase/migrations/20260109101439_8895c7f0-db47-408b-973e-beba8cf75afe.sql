-- Create stories table
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Create story views table
CREATE TABLE IF NOT EXISTS public.story_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(story_id, viewer_id)
);

-- Enable RLS
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stories
CREATE POLICY "Stories are viewable by authenticated users" 
ON public.stories 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND expires_at > now());

CREATE POLICY "Users can create their own stories" 
ON public.stories 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stories" 
ON public.stories 
FOR DELETE 
USING (auth.uid() = user_id);

-- RLS Policies for story_views
CREATE POLICY "Story views are viewable by story owner" 
ON public.story_views 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.stories 
  WHERE stories.id = story_views.story_id 
  AND stories.user_id = auth.uid()
) OR viewer_id = auth.uid());

CREATE POLICY "Users can mark stories as viewed" 
ON public.story_views 
FOR INSERT 
WITH CHECK (auth.uid() = viewer_id);

-- Enable realtime for stories
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;