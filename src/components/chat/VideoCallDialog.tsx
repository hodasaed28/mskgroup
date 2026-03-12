import { useState, useEffect, useRef } from 'react';
import { Profile } from '@/types/database';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
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
  MonitorUp,
  Maximize2,
  Minimize2,
  MoreVertical,
} from 'lucide-react';

type CallType = 'video' | 'voice';
type CallState = 'calling' | 'ringing' | 'connected' | 'ended';

interface VideoCallDialogProps {
  open: boolean;
  onClose: () => void;
  friend: Profile;
  currentUser: Profile;
  callType: CallType;
  isIncoming?: boolean;
}

export function VideoCallDialog({
  open,
  onClose,
  friend,
  currentUser,
  callType,
  isIncoming = false,
}: VideoCallDialogProps) {
  const { toast } = useToast();
  const [callState, setCallState] = useState<CallState>(isIncoming ? 'ringing' : 'calling');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'voice');
  const [callDuration, setCallDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open && !isIncoming) {
      // Simulate call connection after 3 seconds
      const timeout = setTimeout(() => {
        setCallState('connected');
        toast({
          title: 'Connected',
          description: `Call with ${friend.full_name || friend.username} started`,
        });
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [open, isIncoming, friend]);

  useEffect(() => {
    if (callState === 'connected') {
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [callState]);

  useEffect(() => {
    const initMedia = async () => {
      if (open && callState === 'connected' && callType === 'video' && !isVideoOff) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          setLocalStream(stream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        } catch (error) {
          console.error('Failed to get media devices:', error);
          toast({
            title: 'Camera Error',
            description: 'Could not access camera or microphone',
            variant: 'destructive',
          });
        }
      }
    };

    initMedia();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [open, callState, callType, isVideoOff]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    setCallState('ended');
    toast({
      title: 'Call Ended',
      description: `Call duration: ${formatDuration(callDuration)}`,
    });
    setTimeout(onClose, 1000);
  };

  const handleAcceptCall = () => {
    setCallState('connected');
    toast({
      title: 'Call Connected',
      description: `Call with ${friend.full_name || friend.username} started`,
    });
  };

  const handleDeclineCall = () => {
    setCallState('ended');
    toast({
      title: 'Call Declined',
    });
    setTimeout(onClose, 500);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
    }
  };

  const toggleVideo = () => {
    setIsVideoOff(!isVideoOff);
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isVideoOff;
      });
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
              <span className="text-sm">
                {callState === 'calling' && 'Calling...'}
                {callState === 'ringing' && 'Incoming call...'}
                {callState === 'connected' && formatDuration(callDuration)}
                {callState === 'ended' && 'Call ended'}
              </span>
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
            {callType === 'video' && callState === 'connected' && !isVideoOff ? (
              <>
                {/* Remote video (friend) - placeholder since we don't have real WebRTC */}
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                  <Avatar className="h-32 w-32">
                    <AvatarImage src={friend.avatar_url || ''} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-4xl">
                      {friend.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                {/* Local video (self) */}
                <div className="absolute bottom-24 right-4 w-32 h-44 rounded-xl overflow-hidden border-2 border-white/20 shadow-xl">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover bg-zinc-800"
                  />
                </div>
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
                {callState === 'calling' && (
                  <p className="mt-4 text-white/80 animate-pulse">
                    {callType === 'video' ? 'Video' : 'Voice'} calling...
                  </p>
                )}
                {callState === 'ringing' && (
                  <p className="mt-4 text-white/80 animate-pulse">
                    Incoming {callType === 'video' ? 'video' : 'voice'} call...
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Call controls */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
            {callState === 'ringing' ? (
              <div className="flex items-center justify-center gap-8">
                <Button
                  size="lg"
                  variant="destructive"
                  className="rounded-full h-16 w-16"
                  onClick={handleDeclineCall}
                >
                  <PhoneOff className="h-6 w-6" />
                </Button>
                <Button
                  size="lg"
                  className="rounded-full h-16 w-16 bg-green-500 hover:bg-green-600"
                  onClick={handleAcceptCall}
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

                {callType === 'video' && callState === 'connected' && (
                  <Button
                    variant="secondary"
                    size="lg"
                    className="rounded-full h-14 w-14"
                    onClick={() => {
                      toast({
                        title: 'Screen sharing',
                        description: 'Screen sharing coming soon!',
                      });
                    }}
                  >
                    <MonitorUp className="h-5 w-5" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
