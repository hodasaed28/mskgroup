import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Profile, Post, SavedPost, Friendship } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/layout/Header';
import PostCard from '@/components/feed/PostCard';
import { useChatContext } from '@/contexts/ChatContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Camera, UserPlus, MessageCircle, Check, X, Loader2, UserMinus, Eye, Upload, PlayCircle, Bookmark, Users, Image as ImageIcon, Link as LinkIcon, Pin, PinOff, Globe, Edit3 } from 'lucide-react';
import { OnlineIndicator } from '@/components/ui/online-indicator';

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { profile: currentUserProfile, notificationCount, messageCount, toggleChat, selectChat, updateOnlineStatus } = useChatContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [friendCount, setFriendCount] = useState(0);
  const [postCount, setPostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'pending' | 'accepted' | 'received'>('none');
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [showAvatarOptions, setShowAvatarOptions] = useState(false);
  const [showAvatarFullView, setShowAvatarFullView] = useState(false);
  const [showCoverFullView, setShowCoverFullView] = useState(false);
  const [hasStory, setHasStory] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [pinnedPostIds, setPinnedPostIds] = useState<Set<string>>(new Set());
  const [editingLink, setEditingLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [activityStatusVisible, setActivityStatusVisible] = useState(true);
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = user?.id === id;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (id && user) {
      fetchProfile();
      fetchPosts();
      fetchFriends();
      checkFriendship();
      checkHasStory();
      fetchPinnedPosts();
      if (isOwnProfile) {
        fetchSavedPosts();
      }
    }
  }, [id, user, isOwnProfile]);

  const fetchProfile = async () => {
    if (!id) return;
    
    if (isOwnProfile) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
      
      if (data) {
        setProfile(data as unknown as Profile);
        setLinkUrl((data as any).link_url || '');
        setActivityStatusVisible((data as any).is_online !== false);
      }
    } else {
      const { data } = await supabase
        .from('profiles_public')
        .select('*')
        .eq('id', id)
        .single();
      
      if (data) {
        setProfile(data as unknown as Profile);
      }
    }
    setLoading(false);
  };

  const fetchPosts = async () => {
    if (!id) return;
    const { data, count } = await supabase
      .from('posts')
      .select('*, profiles(*)', { count: 'exact' })
      .eq('user_id', id)
      .order('created_at', { ascending: false });
    
    if (data) {
      setPosts(data as unknown as Post[]);
      setPostCount(count || 0);
      const postPhotos = data
        .filter((p: any) => p.image_url)
        .map((p: any) => p.image_url as string);
      setPhotos(postPhotos);
    }
  };

  const fetchFriends = async () => {
    if (!id) return;
    const { data, count } = await supabase
      .from('friendships')
      .select(`
        requester_id,
        addressee_id,
        requester:profiles!friendships_requester_id_fkey(id, username, full_name, avatar_url, is_online),
        addressee:profiles!friendships_addressee_id_fkey(id, username, full_name, avatar_url, is_online)
      `, { count: 'exact' })
      .eq('status', 'accepted')
      .or(`requester_id.eq.${id},addressee_id.eq.${id}`);

    if (data) {
      const friendsList: Profile[] = data.map(friendship => {
        const friend = friendship.requester_id === id 
          ? friendship.addressee 
          : friendship.requester;
        return friend as unknown as Profile;
      });
      setFriends(friendsList);
      setFriendCount(count || 0);
    }
  };

  const fetchSavedPosts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('saved_posts')
      .select(`*, post:posts(*, profiles(*))`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setSavedPosts(data as unknown as SavedPost[]);
  };

  const fetchPinnedPosts = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('pinned_posts' as any)
      .select('post_id')
      .eq('user_id', id);
    if (data) {
      setPinnedPostIds(new Set((data as any[]).map(p => p.post_id)));
    }
  };

  const checkHasStory = async () => {
    if (!id) return;
    const { count } = await supabase
      .from('stories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', id)
      .gt('expires_at', new Date().toISOString());
    setHasStory((count || 0) > 0);
  };

  const checkFriendship = async () => {
    if (!id || !user || id === user.id) return;
    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${user.id})`)
      .single();

    if (data) {
      setFriendshipId(data.id);
      if (data.status === 'accepted') setFriendshipStatus('accepted');
      else if (data.status === 'rejected') setFriendshipStatus('none');
      else if (data.requester_id === user.id) setFriendshipStatus('pending');
      else setFriendshipStatus('received');
    } else {
      setFriendshipStatus('none');
    }
  };

  const sendFriendRequest = async () => {
    if (!user || !id || !currentUserProfile) return;
    if (friendshipId) {
      await supabase.from('friendships').delete().eq('id', friendshipId);
    }
    const { data, error } = await supabase
      .from('friendships')
      .insert({ requester_id: user.id, addressee_id: id })
      .select()
      .single();

    if (!error && data) {
      await supabase.rpc('create_notification', {
        p_user_id: id,
        p_type: 'friend_request',
        p_content: `${currentUserProfile.full_name || currentUserProfile.username} أرسل لك طلب صداقة`,
        p_reference_id: data.id,
      });
      toast({ title: 'تم إرسال طلب الصداقة' });
      checkFriendship();
    }
  };

  const removeFriend = async () => {
    if (!friendshipId) return;
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
    if (!error) {
      toast({ title: 'تم إزالة الصديق' });
      setFriendshipStatus('none');
      setFriendshipId(null);
      fetchFriends();
    }
  };

  const handleFriendRequest = async (accept: boolean) => {
    if (!friendshipId || !currentUserProfile) return;
    const { data: friendship } = await supabase.from('friendships').select('requester_id').eq('id', friendshipId).single();
    const { error } = await supabase.from('friendships').update({ status: accept ? 'accepted' : 'rejected' }).eq('id', friendshipId);
    if (!error && friendship) {
      await supabase.rpc('create_notification', {
        p_user_id: friendship.requester_id,
        p_type: accept ? 'friend_accepted' : 'friend_rejected',
        p_content: accept 
          ? `${currentUserProfile.full_name || currentUserProfile.username} قبل طلب صداقتك` 
          : `${currentUserProfile.full_name || currentUserProfile.username} رفض طلب صداقتك`,
        p_reference_id: friendshipId,
      });
      toast({ title: accept ? 'تم قبول الطلب' : 'تم رفض الطلب' });
      checkFriendship();
      fetchFriends();
    }
  };

  const handleMessage = () => {
    if (profile) { selectChat(profile); toggleChat(); }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('media').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(fileName);
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', user.id);
      if (updateError) throw updateError;
      toast({ title: 'تم تحديث الصورة الشخصية' });
      fetchProfile();
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      setShowAvatarOptions(false);
    }
  };

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/cover-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('media').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(fileName);
      const { error: updateError } = await supabase.from('profiles').update({ cover_url: urlData.publicUrl } as any).eq('id', user.id);
      if (updateError) throw updateError;
      toast({ title: 'تم تحديث صورة الغلاف' });
      fetchProfile();
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveLink = async () => {
    if (!user) return;
    await supabase.from('profiles').update({ link_url: linkUrl || null } as any).eq('id', user.id);
    toast({ title: 'تم حفظ الرابط' });
    setEditingLink(false);
    fetchProfile();
  };

  const handleTogglePinPost = async (postId: string) => {
    if (!user) return;
    if (pinnedPostIds.has(postId)) {
      await supabase.from('pinned_posts' as any).delete().eq('user_id', user.id).eq('post_id', postId);
      toast({ title: 'تم إلغاء التثبيت' });
    } else {
      await supabase.from('pinned_posts' as any).insert({ user_id: user.id, post_id: postId } as any);
      toast({ title: 'تم تثبيت المنشور' });
    }
    fetchPinnedPosts();
  };

  const handleToggleActivityStatus = async () => {
    if (!user) return;
    const newStatus = !activityStatusVisible;
    setActivityStatusVisible(newStatus);
    await supabase.from('profiles').update({ is_online: newStatus ? true : false } as any).eq('id', user.id);
    toast({ title: newStatus ? 'حالة النشاط مرئية' : 'حالة النشاط مخفية' });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <p className="text-muted-foreground">المستخدم غير موجود</p>
      </div>
    );
  }

  // Sort posts: pinned first
  const sortedPosts = [...posts].sort((a, b) => {
    const aPinned = pinnedPostIds.has(a.id);
    const bPinned = pinnedPostIds.has(b.id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return 0;
  });

  return (
    <div className="min-h-screen bg-background">
      <Header 
        profile={currentUserProfile} 
        notificationCount={notificationCount}
        messageCount={messageCount}
        onMessagesClick={toggleChat}
      />

      <div className="max-w-4xl mx-auto" dir="rtl">
        {/* Cover Photo */}
        <div 
          className="h-56 md:h-80 gradient-primary relative cursor-pointer overflow-hidden"
          onClick={() => (profile as any).cover_url && setShowCoverFullView(true)}
          style={(profile as any).cover_url ? { backgroundImage: `url(${(profile as any).cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
        >
          {/* Gradient overlay */}
          {!(profile as any).cover_url && (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,hsl(var(--accent)/0.3),transparent_60%)]" />
          )}
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
          {isOwnProfile && (
            <>
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
              <Button variant="secondary" size="sm" className="absolute bottom-4 left-4 rounded-xl glass border-0"
                onClick={(e) => { e.stopPropagation(); coverInputRef.current?.click(); }} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Camera className="h-4 w-4 ml-2" />}
                تغيير الغلاف
              </Button>
            </>
          )}
        </div>

        {/* Cover Full View */}
        <Dialog open={showCoverFullView} onOpenChange={setShowCoverFullView}>
          <DialogContent className="sm:max-w-4xl bg-black/90 border-0 p-0">
            <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white hover:bg-white/20 z-10" onClick={() => setShowCoverFullView(false)}>
              <X className="h-6 w-6" />
            </Button>
            <div className="flex items-center justify-center min-h-[60vh]">
              {(profile as any).cover_url && (
                <img src={(profile as any).cover_url} alt="Cover" className="max-w-full max-h-[80vh] object-contain" />
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Profile Info */}
        <div className="px-4 md:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4 -mt-20 md:-mt-24">
            {/* Avatar with options */}
            <Dialog open={showAvatarOptions} onOpenChange={setShowAvatarOptions}>
              <DialogTrigger asChild>
                <div className={`relative cursor-pointer group ${hasStory ? 'ring-4 ring-primary ring-offset-2 ring-offset-background rounded-full' : ''}`}>
                  <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-background shadow-elevated">
                    <AvatarImage src={profile.avatar_url || ''} />
                    <AvatarFallback className="text-4xl bg-primary text-primary-foreground">
                      {profile.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {!isOwnProfile && (
                    <div className="absolute bottom-4 right-0">
                      <OnlineIndicator isOnline={(profile as any).is_online} showDot={true} className="w-4 h-4" />
                    </div>
                  )}
                  {isOwnProfile && (
                    <Button variant="secondary" size="icon" className="absolute bottom-2 left-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xs" dir="rtl">
                <div className="flex flex-col gap-2 p-2">
                  {profile.avatar_url && (
                    <Button variant="ghost" className="w-full justify-start gap-3"
                      onClick={() => { setShowAvatarOptions(false); setShowAvatarFullView(true); }}>
                      <Eye className="h-5 w-5" />
                      عرض الصورة
                    </Button>
                  )}
                  {hasStory && (
                    <Button variant="ghost" className="w-full justify-start gap-3"
                      onClick={() => { setShowAvatarOptions(false); }}>
                      <PlayCircle className="h-5 w-5" />
                      عرض القصة
                    </Button>
                  )}
                  {isOwnProfile && (
                    <>
                      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                      <Button variant="ghost" className="w-full justify-start gap-3"
                        onClick={() => avatarInputRef.current?.click()} disabled={uploading}>
                        {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                        تغيير الصورة
                      </Button>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Avatar Full View Dialog */}
            <Dialog open={showAvatarFullView} onOpenChange={setShowAvatarFullView}>
              <DialogContent className="sm:max-w-2xl bg-black/90 border-0 p-0">
                <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white hover:bg-white/20 z-10" onClick={() => setShowAvatarFullView(false)}>
                  <X className="h-6 w-6" />
                </Button>
                <div className="flex items-center justify-center min-h-[60vh]">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.full_name || profile.username} className="max-w-full max-h-[80vh] object-contain" />
                  ) : (
                    <div className="w-64 h-64 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-8xl text-primary-foreground font-bold">{profile.username.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                </div>
                <div className="p-4 text-center text-white">
                  <p className="font-semibold text-lg">{profile.full_name || profile.username}</p>
                  <p className="text-white/70">@{profile.username}</p>
                </div>
              </DialogContent>
            </Dialog>

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold">
                  {profile.full_name || profile.username}
                </h1>
                {!isOwnProfile && (
                  <OnlineIndicator isOnline={(profile as any).is_online} lastSeen={(profile as any).last_seen} showText={true} />
                )}
              </div>
              <p className="text-muted-foreground">@{profile.username}</p>
              {profile.bio && <p className="mt-2 text-sm">{profile.bio}</p>}
              
              {/* Link in Bio */}
              {(profile as any).link_url && !editingLink && (
                <a href={(profile as any).link_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 mt-1 text-sm text-primary hover:underline">
                  <LinkIcon className="h-3.5 w-3.5" />
                  {(profile as any).link_url.replace(/^https?:\/\//, '').slice(0, 40)}
                </a>
              )}
              {isOwnProfile && editingLink && (
                <div className="flex items-center gap-2 mt-2">
                  <Input placeholder="https://example.com" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="h-8 text-sm" />
                  <Button size="sm" onClick={handleSaveLink}>حفظ</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingLink(false)}>إلغاء</Button>
                </div>
              )}
              {isOwnProfile && !editingLink && (
                <Button variant="ghost" size="sm" className="mt-1 h-7 text-xs gap-1" onClick={() => setEditingLink(true)}>
                  <Edit3 className="h-3 w-3" />
                  {(profile as any).link_url ? 'تعديل الرابط' : 'إضافة رابط'}
                </Button>
              )}

              {/* Stats */}
              <div className="flex items-center gap-5 mt-4">
                <div className="glass rounded-xl px-4 py-2 text-center">
                  <span className="font-bold text-lg block">{friendCount}</span>
                  <span className="text-xs text-muted-foreground">صديق</span>
                </div>
                <div className="glass rounded-xl px-4 py-2 text-center">
                  <span className="font-bold text-lg block">{postCount}</span>
                  <span className="text-xs text-muted-foreground">منشور</span>
                </div>
              </div>

              {/* Activity Status Toggle (own profile only) */}
              {isOwnProfile && (
                <div className="flex items-center gap-2 mt-3">
                  <Switch checked={activityStatusVisible} onCheckedChange={handleToggleActivityStatus} />
                  <span className="text-sm text-muted-foreground">إظهار حالة النشاط</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {!isOwnProfile && (
                <>
                  {friendshipStatus === 'none' && (
                    <Button onClick={sendFriendRequest}>
                      <UserPlus className="h-4 w-4 ml-2" />
                      إضافة صديق
                    </Button>
                  )}
                  {friendshipStatus === 'pending' && (
                    <Button variant="secondary" disabled>تم إرسال الطلب</Button>
                  )}
                  {friendshipStatus === 'received' && (
                    <div className="flex gap-2">
                      <Button onClick={() => handleFriendRequest(true)}>
                        <Check className="h-4 w-4 ml-2" />قبول
                      </Button>
                      <Button variant="outline" onClick={() => handleFriendRequest(false)}>
                        <X className="h-4 w-4 ml-2" />رفض
                      </Button>
                    </div>
                  )}
                  {friendshipStatus === 'accepted' && (
                    <>
                      <Button variant="secondary" onClick={handleMessage}>
                        <MessageCircle className="h-4 w-4 ml-2" />مراسلة
                      </Button>
                      <Button variant="outline" onClick={removeFriend}>
                        <UserMinus className="h-4 w-4 ml-2" />إزالة صديق
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="posts" className="mt-6">
            <TabsList className="w-full justify-start flex-wrap">
              <TabsTrigger value="posts">المنشورات</TabsTrigger>
              <TabsTrigger value="about">حول</TabsTrigger>
              <TabsTrigger value="friends">الأصدقاء</TabsTrigger>
              <TabsTrigger value="photos">الصور</TabsTrigger>
              {isOwnProfile && (
                <TabsTrigger value="saved">
                  <Bookmark className="h-4 w-4 ml-1" />
                  المحفوظات
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="posts" className="mt-4 space-y-4">
              {sortedPosts.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">لا توجد منشورات بعد</Card>
              ) : (
                sortedPosts.map((post) => (
                  <div key={post.id} className="relative">
                    {pinnedPostIds.has(post.id) && (
                      <div className="flex items-center gap-1 text-xs text-primary mb-1 px-2">
                        <Pin className="h-3 w-3" />
                        <span>منشور مثبت</span>
                      </div>
                    )}
                    <PostCard post={post} currentUser={currentUserProfile} onDelete={fetchPosts} />
                    {isOwnProfile && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 left-2 h-8 w-8"
                        onClick={() => handleTogglePinPost(post.id)}
                        title={pinnedPostIds.has(post.id) ? 'إلغاء التثبيت' : 'تثبيت المنشور'}
                      >
                        {pinnedPostIds.has(post.id) ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="about" className="mt-4">
              <Card className="p-6">
                <h3 className="font-semibold mb-4">معلومات عامة</h3>
                <div className="space-y-3 text-sm">
                  <p><span className="text-muted-foreground">اسم المستخدم:</span> @{profile.username}</p>
                  {profile.full_name && (
                    <p><span className="text-muted-foreground">الاسم الكامل:</span> {profile.full_name}</p>
                  )}
                  {profile.bio && (
                    <p><span className="text-muted-foreground">نبذة:</span> {profile.bio}</p>
                  )}
                  {(profile as any).link_url && (
                    <p>
                      <span className="text-muted-foreground">الرابط:</span>{' '}
                      <a href={(profile as any).link_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {(profile as any).link_url}
                      </a>
                    </p>
                  )}
                  <p>
                    <span className="text-muted-foreground">تاريخ الانضمام:</span>{' '}
                    {new Date(profile.created_at).toLocaleDateString('ar-EG')}
                  </p>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="friends" className="mt-4">
              {friends.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">لا يوجد أصدقاء بعد</Card>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {friends.map((friend) => (
                    <Link key={friend.id} to={`/profile/${friend.id}`}>
                      <Card className="p-4 hover:bg-muted transition-colors">
                        <div className="flex flex-col items-center text-center gap-2">
                          <div className="relative">
                            <Avatar className="h-16 w-16">
                              <AvatarImage src={friend.avatar_url || ''} />
                              <AvatarFallback className="bg-primary text-primary-foreground">
                                {friend.username.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {(friend as any).is_online && (
                              <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-background" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-sm truncate max-w-full">{friend.full_name || friend.username}</p>
                            <p className="text-xs text-muted-foreground">@{friend.username}</p>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="photos" className="mt-4">
              {photos.length === 0 ? (
                <Card className="p-8 text-center text-muted-foreground">لا توجد صور بعد</Card>
              ) : (
                <>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                    {photos.map((photo, index) => (
                      <div key={index} className="aspect-square cursor-pointer overflow-hidden rounded-lg hover:opacity-90 transition-opacity"
                        onClick={() => setSelectedPhoto(photo)}>
                        <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
                    <DialogContent className="sm:max-w-4xl bg-black/90 border-0 p-0">
                      <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white hover:bg-white/20 z-10" onClick={() => setSelectedPhoto(null)}>
                        <X className="h-6 w-6" />
                      </Button>
                      <div className="flex items-center justify-center min-h-[60vh]">
                        {selectedPhoto && <img src={selectedPhoto} alt="Photo" className="max-w-full max-h-[80vh] object-contain" />}
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </TabsContent>

            {isOwnProfile && (
              <TabsContent value="saved" className="mt-4 space-y-4">
                {savedPosts.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground">
                    <Bookmark className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>لا توجد منشورات محفوظة</p>
                    <p className="text-sm mt-1">احفظ المنشورات التي تعجبك لتجدها هنا</p>
                  </Card>
                ) : (
                  savedPosts.map((saved) => (
                    saved.post && (
                      <PostCard key={saved.id} post={saved.post as unknown as Post} currentUser={currentUserProfile} onDelete={fetchSavedPosts} />
                    )
                  ))
                )}
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
