import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Profile, Reel } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/layout/Header';
import { useChat } from '@/hooks/useChat';
import ChatSidebar from '@/components/chat/ChatSidebar';
import ChatWindow from '@/components/chat/ChatWindow';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Plus, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

export default function ReelsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [likes, setLikes] = useState<{ [key: string]: number }>({});
  const [likedReels, setLikedReels] = useState<Set<string>>(new Set());
  const [notificationCount, setNotificationCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const videoRefs = useRef<{ [key: number]: HTMLVideoElement }>({});

  const { chatOpen, selectedChat, messageCount, toggleChat, closeChat, selectChat, closeSelectedChat } = useChat(user?.id);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchReels();
      fetchNotificationCount();
    }
  }, [user]);

  useEffect(() => {
    // Auto-play current video
    Object.entries(videoRefs.current).forEach(([index, video]) => {
      if (parseInt(index) === currentIndex) {
        video.play().catch(() => {});
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, [currentIndex, reels]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (data) setProfile(data as unknown as Profile);
  };

  const fetchReels = async () => {
    const { data } = await supabase
      .from('reels')
      .select('*, profiles(*)')
      .order('created_at', { ascending: false });

    if (data) {
      setReels(data as unknown as Reel[]);
      // Fetch likes for all reels
      const reelIds = data.map(r => r.id);
      const { data: likesData } = await supabase
        .from('reels_likes')
        .select('reel_id, user_id')
        .in('reel_id', reelIds);

      if (likesData) {
        const likeCounts: { [key: string]: number } = {};
        const userLikes = new Set<string>();
        likesData.forEach(like => {
          likeCounts[like.reel_id] = (likeCounts[like.reel_id] || 0) + 1;
          if (like.user_id === user?.id) {
            userLikes.add(like.reel_id);
          }
        });
        setLikes(likeCounts);
        setLikedReels(userLikes);
      }
    }
    setLoading(false);
  };

  const fetchNotificationCount = async () => {
    if (!user) return;
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setNotificationCount(count || 0);
  };

  const handleLike = async (reelId: string) => {
    if (!user) return;

    if (likedReels.has(reelId)) {
      await supabase
        .from('reels_likes')
        .delete()
        .eq('reel_id', reelId)
        .eq('user_id', user.id);
      
      setLikedReels(prev => {
        const next = new Set(prev);
        next.delete(reelId);
        return next;
      });
      setLikes(prev => ({ ...prev, [reelId]: (prev[reelId] || 1) - 1 }));
    } else {
      await supabase
        .from('reels_likes')
        .insert({ reel_id: reelId, user_id: user.id });
      
      setLikedReels(prev => new Set(prev).add(reelId));
      setLikes(prev => ({ ...prev, [reelId]: (prev[reelId] || 0) + 1 }));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) {
        toast({
          title: 'خطأ',
          description: 'حجم الفيديو يجب أن يكون أقل من 100 ميجابايت',
          variant: 'destructive',
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !profile) return;

    setIsUploading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${profile.id}/${Date.now()}.${fileExt}`;
      const filePath = `reels/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from('reels')
        .insert({
          user_id: profile.id,
          video_url: publicUrl,
          caption: caption.trim() || null,
        });

      if (insertError) throw insertError;

      toast({ title: 'تم نشر الريل بنجاح!' });
      setDialogOpen(false);
      setSelectedFile(null);
      setCaption('');
      fetchReels();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في نشر الريل',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const goToNext = () => {
    if (currentIndex < reels.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        profile={profile}
        notificationCount={notificationCount}
        messageCount={messageCount}
        onMessagesClick={toggleChat}
      />

      <div className="flex justify-center items-center py-4" dir="rtl">
        <div className="relative w-full max-w-md h-[calc(100vh-120px)]">
          {/* Upload Button */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="absolute top-4 left-4 z-20 rounded-full"
                size="icon"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>نشر ريل جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {selectedFile ? (
                  <div className="space-y-2">
                    <video
                      src={URL.createObjectURL(selectedFile)}
                      className="w-full h-48 object-cover rounded-lg"
                      controls
                    />
                    <p className="text-sm text-muted-foreground">{selectedFile.name}</p>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full h-32"
                    onClick={() => videoInputRef.current?.click()}
                  >
                    اختر فيديو
                  </Button>
                )}
                <Textarea
                  placeholder="اكتب وصفاً للريل..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
                <Button
                  className="w-full"
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                      جارٍ الرفع...
                    </>
                  ) : (
                    'نشر'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {reels.length === 0 ? (
            <Card className="h-full flex items-center justify-center">
              <p className="text-muted-foreground">لا توجد ريلز بعد</p>
            </Card>
          ) : (
            <div className="relative h-full">
              {/* Navigation Arrows */}
              <div className="absolute left-1/2 -translate-x-1/2 top-4 z-10 flex flex-col gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-black/20 text-white hover:bg-black/40 rounded-full"
                  onClick={goToPrevious}
                  disabled={currentIndex === 0}
                >
                  <ChevronUp className="h-6 w-6" />
                </Button>
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-black/20 text-white hover:bg-black/40 rounded-full"
                  onClick={goToNext}
                  disabled={currentIndex === reels.length - 1}
                >
                  <ChevronDown className="h-6 w-6" />
                </Button>
              </div>

              {reels.map((reel, index) => (
                <div
                  key={reel.id}
                  className={`absolute inset-0 transition-opacity duration-300 ${
                    index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                  }`}
                >
                  <div className="relative h-full rounded-2xl overflow-hidden bg-black">
                    <video
                      ref={(el) => { if (el) videoRefs.current[index] = el; }}
                      src={reel.video_url}
                      className="w-full h-full object-cover"
                      loop
                      muted={muted}
                      playsInline
                      onClick={() => {
                        const video = videoRefs.current[index];
                        if (video.paused) video.play();
                        else video.pause();
                      }}
                    />

                    {/* Controls Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                      <div className="flex items-end justify-between">
                        <div className="text-white space-y-2">
                          <Link to={`/profile/${reel.user_id}`} className="flex items-center gap-2">
                            <Avatar className="h-10 w-10 border-2 border-white">
                              <AvatarImage src={reel.profiles?.avatar_url || ''} />
                              <AvatarFallback>
                                {reel.profiles?.username?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-semibold">
                              {reel.profiles?.full_name || reel.profiles?.username}
                            </span>
                          </Link>
                          {reel.caption && (
                            <p className="text-sm max-w-[200px]">{reel.caption}</p>
                          )}
                        </div>

                        <div className="flex flex-col items-center gap-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/20 rounded-full"
                            onClick={() => handleLike(reel.id)}
                          >
                            <Heart
                              className={`h-7 w-7 ${likedReels.has(reel.id) ? 'fill-red-500 text-red-500' : ''}`}
                            />
                          </Button>
                          <span className="text-white text-sm">{likes[reel.id] || 0}</span>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/20 rounded-full"
                          >
                            <MessageCircle className="h-7 w-7" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/20 rounded-full"
                          >
                            <Share2 className="h-7 w-7" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/20 rounded-full"
                            onClick={() => setMuted(!muted)}
                          >
                            {muted ? (
                              <VolumeX className="h-7 w-7" />
                            ) : (
                              <Volume2 className="h-7 w-7" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ChatSidebar
        isOpen={chatOpen}
        onClose={closeChat}
        currentUser={profile}
        onSelectChat={selectChat}
        selectedChat={selectedChat}
      />

      {selectedChat && profile && (
        <ChatWindow
          friend={selectedChat}
          currentUser={profile}
          onClose={closeSelectedChat}
        />
      )}
    </div>
  );
}
