import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/database';

// Free STUN/TURN servers for NAT traversal
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  // Open TURN server (for testing - in production use your own)
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export type CallState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';
export type CallType = 'video' | 'voice';

interface SignalData {
  type: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}

interface WebRTCSignal {
  id: string;
  caller_id: string;
  callee_id: string;
  call_type: CallType;
  signal_type: string;
  signal_data: SignalData | null;
  created_at: string;
}

interface UseWebRTCProps {
  currentUser: Profile;
  friend: Profile;
  callType: CallType;
  onCallEnded?: () => void;
}

export function useWebRTC({ currentUser, friend, callType, onCallEnded }: UseWebRTCProps) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'voice');
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const signalChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const isInitiatorRef = useRef(false);

  // Clean up expired signals
  const cleanupSignals = useCallback(async () => {
    await supabase
      .from('webrtc_signals')
      .delete()
      .or(`caller_id.eq.${currentUser.id},callee_id.eq.${currentUser.id}`);
  }, [currentUser.id]);

  // Send signal to peer via database
  const sendSignal = useCallback(async (signalType: string, signalData: SignalData | null = null) => {
    try {
      const { error } = await supabase
        .from('webrtc_signals')
        .insert({
          caller_id: currentUser.id,
          callee_id: friend.id,
          call_type: callType,
          signal_type: signalType,
          signal_data: signalData as any,
        });
      
      if (error) {
        console.error('Error sending signal:', error);
      }
    } catch (err) {
      console.error('Failed to send signal:', err);
    }
  }, [currentUser.id, friend.id, callType]);

  // Initialize peer connection
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal('ice-candidate', { type: 'candidate', candidate: event.candidate.toJSON() });
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStream(stream);
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallState('connected');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected') {
        setCallState('connected');
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [sendSignal]);

  // Get local media stream
  const getLocalStream = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: callType === 'video',
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
    } catch (err: any) {
      setError('Could not access camera or microphone');
      console.error('Media error:', err);
      return null;
    }
  }, [callType]);

  // Start outgoing call
  const startCall = useCallback(async () => {
    isInitiatorRef.current = true;
    setCallState('calling');
    setError(null);

    await cleanupSignals();
    
    const stream = await getLocalStream();
    if (!stream) {
      setCallState('idle');
      return;
    }

    const pc = createPeerConnection();
    
    // Add local tracks to connection
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Send call request
    await sendSignal('call-request', null);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal('offer', { type: 'offer', sdp: offer.sdp });
    } catch (err) {
      console.error('Error creating offer:', err);
      setError('Failed to start call');
      setCallState('idle');
    }
  }, [cleanupSignals, getLocalStream, createPeerConnection, sendSignal]);

  // Accept incoming call
  const acceptCall = useCallback(async (offerSdp?: string) => {
    isInitiatorRef.current = false;
    setCallState('connected');
    setError(null);

    const stream = await getLocalStream();
    if (!stream) {
      await sendSignal('call-rejected', null);
      return;
    }

    const pc = createPeerConnection();
    
    // Add local tracks
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Set remote description if we have the offer
    if (offerSdp) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offerSdp }));
        
        // Add any pending ICE candidates
        for (const candidate of pendingCandidatesRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingCandidatesRef.current = [];
        
        // Create and send answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal('answer', { type: 'answer', sdp: answer.sdp });
      } catch (err) {
        console.error('Error accepting call:', err);
        setError('Failed to connect');
      }
    }

    await sendSignal('call-accepted', null);
  }, [getLocalStream, createPeerConnection, sendSignal]);

  // Reject incoming call
  const rejectCall = useCallback(async () => {
    await sendSignal('call-rejected', null);
    setCallState('idle');
    onCallEnded?.();
  }, [sendSignal, onCallEnded]);

  // End call
  const endCall = useCallback(async () => {
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Clear timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    // Send end signal
    await sendSignal('call-ended', null);
    
    // Cleanup
    await cleanupSignals();

    setCallState('ended');
    setTimeout(() => {
      onCallEnded?.();
    }, 1500);
  }, [sendSignal, cleanupSignals, onCallEnded]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(prev => !prev);
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(prev => !prev);
    }
  }, []);

  // Handle incoming signals
  const handleSignal = useCallback(async (signal: WebRTCSignal) => {
    const pc = peerConnectionRef.current;

    switch (signal.signal_type) {
      case 'call-request':
        if (callState === 'idle') {
          setCallState('ringing');
        }
        break;

      case 'offer':
        if (signal.signal_data?.sdp && pc && callState === 'ringing') {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription({ 
              type: 'offer', 
              sdp: signal.signal_data.sdp 
            }));
            
            // Add pending candidates
            for (const candidate of pendingCandidatesRef.current) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
            pendingCandidatesRef.current = [];
            
            // Create answer
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendSignal('answer', { type: 'answer', sdp: answer.sdp });
          } catch (err) {
            console.error('Error handling offer:', err);
          }
        } else if (signal.signal_data?.sdp && callState === 'ringing') {
          // Store for when we accept
          pendingCandidatesRef.current = [];
        }
        break;

      case 'answer':
        if (signal.signal_data?.sdp && pc && isInitiatorRef.current) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription({ 
              type: 'answer', 
              sdp: signal.signal_data.sdp 
            }));
          } catch (err) {
            console.error('Error handling answer:', err);
          }
        }
        break;

      case 'ice-candidate':
        if (signal.signal_data?.candidate) {
          if (pc && pc.remoteDescription) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.signal_data.candidate));
            } catch (err) {
              console.error('Error adding ICE candidate:', err);
            }
          } else {
            // Queue candidate
            pendingCandidatesRef.current.push(signal.signal_data.candidate);
          }
        }
        break;

      case 'call-accepted':
        setCallState('connected');
        break;

      case 'call-rejected':
        setCallState('ended');
        await cleanupSignals();
        setTimeout(() => onCallEnded?.(), 1500);
        break;

      case 'call-ended':
        await endCall();
        break;
    }
  }, [callState, sendSignal, cleanupSignals, onCallEnded, endCall]);

  // Subscribe to signals
  useEffect(() => {
    const channel = supabase
      .channel(`webrtc-${currentUser.id}-${friend.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webrtc_signals',
          filter: `callee_id=eq.${currentUser.id}`,
        },
        (payload) => {
          const signal = payload.new as WebRTCSignal;
          if (signal.caller_id === friend.id) {
            handleSignal(signal);
          }
        }
      )
      .subscribe();

    signalChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser.id, friend.id, handleSignal]);

  // Call duration timer
  useEffect(() => {
    if (callState === 'connected') {
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [callState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, []);

  return {
    callState,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    callDuration,
    error,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    setCallState,
  };
}
