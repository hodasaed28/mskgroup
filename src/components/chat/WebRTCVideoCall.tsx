import { useEffect, useRef } from 'react';
import { Profile } from '@/types/database';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useWebRTC, CallType, CallState } from '@/hooks/useWebRTC';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  PhoneOff,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useState } from 'react';

interface WebRTCVideoCallProps {
  open: boolean;
  onClose: () => void;
  friend: Profile;
  currentUser: Profile;
  callType: CallType;
  isIncoming?: boolean;
  incomingOfferSdp?: string;
}

export function WebRTCVideoCall({
  open,
  onClose,
  friend,
  currentUser,
  callType,
  isIncoming = false,
  incomingOfferSdp,
}: WebRTCVideoCallProps) {
  const { toast } = useToast();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const {
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
  } = useWebRTC({
    currentUser,
    friend,
    callType,
    onCallEnded: onClose,
  });

  // Start call when dialog opens (for outgoing calls)
  useEffect(() => {
    if (open && !isIncoming && callState === 'idle') {
      startCall();
    }
  }, [open, isIncoming, callState, startCall]);

  // Set ringing state for incoming calls
  useEffect(() => {
    if (open && isIncoming && callState === 'idle') {
      setCallState('ringing');
    }
  }, [open, isIncoming, callState, setCallState]);

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Show error toast
  useEffect(() => {
    if (error) {
      toast({
        title: 'Call Error',
        description: error,
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  // Show connection toast
  useEffect(() => {
    if (callState === 'connected') {
      toast({
        title: 'Connected',
        description: `Call with ${friend.full_name || friend.username} started`,
      });
    }
  }, [callState, friend, toast]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAccept = () => {
    acceptCall(incomingOfferSdp);
  };

  const handleDecline = () => {
    rejectCall();
  };

  const handleEndCall = () => {
    toast({
      title: 'Call Ended',
      description: `Call duration: ${formatDuration(callDuration)}`,
    });
    endCall();
  };

  const getStatusText = () => {
    switch (callState) {
      case 'calling':
        return 'Calling...';
      case 'ringing':
        return 'Incoming call...';
      case 'connected':
        return formatDuration(callDuration);
      case 'ended':
        return 'Call ended';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className={`p-0 gap-0 overflow-hidden ${
          isFullscreen ? 'max-w-full w-full h-full' : 'max-w-lg'
        }`}
      >
        <div className="relative bg-gradient-to-b from-zinc-900 to-zinc-950 min-h-[500px] flex flex-col">
          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
            <div className="flex items-center gap-2 text-white">
              {callType === 'video' ? (
                <Video className="h-4 w-4" />
              ) : (
                <Phone className="h-4 w-4" />
              )}
              <span className="text-sm">{getStatusText()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Main video/avatar area */}
          <div className="flex-1 flex items-center justify-center relative">
            {callType === 'video' && callState === 'connected' && remoteStream ? (
              <>
                {/* Remote video (friend) */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover bg-zinc-900"
                />
                {/* Local video (self) */}
                {!isVideoOff && localStream && (
                  <div className="absolute bottom-24 right-4 w-32 h-44 rounded-xl overflow-hidden border-2 border-white/20 shadow-xl">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover bg-zinc-800"
                    />
                  </div>
                )}
              </>
            ) : callType === 'video' && callState === 'connected' && !remoteStream ? (
              <>
                {/* Waiting for remote video */}
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                  <div className="text-center">
                    <Avatar className="h-32 w-32 mx-auto mb-4">
                      <AvatarImage src={friend.avatar_url || ''} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-4xl">
                        {friend.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-white/60">Connecting video...</p>
                  </div>
                </div>
                {/* Local video preview */}
                {!isVideoOff && localStream && (
                  <div className="absolute bottom-24 right-4 w-32 h-44 rounded-xl overflow-hidden border-2 border-white/20 shadow-xl">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover bg-zinc-800"
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="text-center">
                <Avatar className="h-32 w-32 mx-auto mb-4 ring-4 ring-white/20">
                  <AvatarImage src={friend.avatar_url || ''} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-4xl">
                    {friend.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-xl font-semibold text-white">
                  {friend.full_name || friend.username}
                </h3>
                <p className="text-white/60 text-sm">@{friend.username}</p>
                {(callState === 'calling' || callState === 'ringing') && (
                  <p className="mt-4 text-white/80 animate-pulse">
                    {callState === 'calling' 
                      ? `${callType === 'video' ? 'Video' : 'Voice'} calling...`
                      : `Incoming ${callType === 'video' ? 'video' : 'voice'} call...`
                    }
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Call controls */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
            {callState === 'ringing' && isIncoming ? (
              <div className="flex items-center justify-center gap-8">
                <Button
                  size="lg"
                  variant="destructive"
                  className="rounded-full h-16 w-16"
                  onClick={handleDecline}
                >
                  <PhoneOff className="h-6 w-6" />
                </Button>
                <Button
                  size="lg"
                  className="rounded-full h-16 w-16 bg-green-500 hover:bg-green-600"
                  onClick={handleAccept}
                >
                  <Phone className="h-6 w-6" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant={isMuted ? 'destructive' : 'secondary'}
                  size="lg"
                  className="rounded-full h-14 w-14"
                  onClick={toggleMute}
                >
                  {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>

                {callType === 'video' && (
                  <Button
                    variant={isVideoOff ? 'destructive' : 'secondary'}
                    size="lg"
                    className="rounded-full h-14 w-14"
                    onClick={toggleVideo}
                  >
                    {isVideoOff ? (
                      <VideoOff className="h-5 w-5" />
                    ) : (
                      <Video className="h-5 w-5" />
                    )}
                  </Button>
                )}

                <Button
                  variant="destructive"
                  size="lg"
                  className="rounded-full h-16 w-16"
                  onClick={handleEndCall}
                >
                  <PhoneOff className="h-6 w-6" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
