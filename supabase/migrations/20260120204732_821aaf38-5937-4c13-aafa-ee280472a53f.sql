-- Create webrtc_signals table for peer-to-peer call signaling
CREATE TABLE public.webrtc_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  callee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL CHECK (call_type IN ('video', 'voice')),
  signal_type TEXT NOT NULL CHECK (signal_type IN ('offer', 'answer', 'ice-candidate', 'call-request', 'call-accepted', 'call-rejected', 'call-ended')),
  signal_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '2 minutes')
);

-- Enable Row Level Security
ALTER TABLE public.webrtc_signals ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can insert their own signals"
ON public.webrtc_signals
FOR INSERT
WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Users can view signals for their calls"
ON public.webrtc_signals
FOR SELECT
USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE POLICY "Users can delete their own signals"
ON public.webrtc_signals
FOR DELETE
USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- Enable realtime for signaling
ALTER PUBLICATION supabase_realtime ADD TABLE public.webrtc_signals;

-- Create index for efficient querying
CREATE INDEX idx_webrtc_signals_callee ON public.webrtc_signals(callee_id, created_at DESC);
CREATE INDEX idx_webrtc_signals_caller ON public.webrtc_signals(caller_id, created_at DESC);

-- Create function to clean up expired signals
CREATE OR REPLACE FUNCTION public.cleanup_expired_signals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.webrtc_signals WHERE expires_at < now();
END;
$$;