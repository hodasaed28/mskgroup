import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/database';
import { WebRTCVideoCall } from './WebRTCVideoCall';
import { CallType } from '@/hooks/useWebRTC';

interface IncomingCall {
  callerId: string;
  callerProfile: Profile | null;
  callType: CallType;
  offerSdp?: string;
}

interface IncomingCallListenerProps {
  currentUser: Profile;
}

export function IncomingCallListener({ currentUser }: IncomingCallListenerProps) {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [showCallDialog, setShowCallDialog] = useState(false);

  const fetchCallerProfile = useCallback(async (callerId: string): Promise<Profile | null> => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', callerId)
      .single();
    return data as Profile | null;
  }, []);

  useEffect(() => {
    // Subscribe to incoming call signals
    const channel = supabase
      .channel(`incoming-calls-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webrtc_signals',
          filter: `callee_id=eq.${currentUser.id}`,
        },
        async (payload) => {
          const signal = payload.new as any;
          
          // Only respond to call-request signals
          if (signal.signal_type === 'call-request' && !showCallDialog) {
            const callerProfile = await fetchCallerProfile(signal.caller_id);
            
            if (callerProfile) {
              setIncomingCall({
                callerId: signal.caller_id,
                callerProfile,
                callType: signal.call_type as CallType,
              });
              setShowCallDialog(true);
            }
          }
          
          // Store offer SDP for when call is accepted
          if (signal.signal_type === 'offer' && signal.signal_data?.sdp && incomingCall) {
            setIncomingCall(prev => prev ? {
              ...prev,
              offerSdp: signal.signal_data.sdp
            } : null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser.id, fetchCallerProfile, showCallDialog, incomingCall]);

  const handleClose = () => {
    setShowCallDialog(false);
    setIncomingCall(null);
  };

  if (!incomingCall || !incomingCall.callerProfile) return null;

  return (
    <WebRTCVideoCall
      open={showCallDialog}
      onClose={handleClose}
      friend={incomingCall.callerProfile}
      currentUser={currentUser}
      callType={incomingCall.callType}
      isIncoming={true}
      incomingOfferSdp={incomingCall.offerSdp}
    />
  );
}
