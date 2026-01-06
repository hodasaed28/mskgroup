import { useState, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Image, Video, Smile, Send, X, Globe, Users, Lock, Loader2 } from 'lucide-react';
import { Profile } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CreatePostProps {
  profile: Profile | null;
  onPostCreated: () => void;
}

export default function CreatePost({ profile, onPostCreated }: CreatePostProps) {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [visibility, setVisibility] = useState<'everyone' | 'friends' | 'only_me'>('everyone');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'خطأ',
          description: 'حجم الصورة يجب أن يكون أقل من 10 ميجابايت',
          variant: 'destructive',
        });
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setVideoFile(null);
      setVideoPreview(null);
    }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: 'خطأ',
          description: 'حجم الفيديو يجب أن يكون أقل من 50 ميجابايت',
          variant: 'destructive',
        });
        return;
      }
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
      setImageFile(null);
      setImagePreview(null);
    }
  };

  const clearMedia = () => {
    setImageFile(null);
    setVideoFile(null);
    setImagePreview(null);
    setVideoPreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const uploadFile = async (file: File, type: 'image' | 'video') => {
    if (!profile) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${profile.id}/${Date.now()}.${fileExt}`;
    const filePath = `${type}s/${fileName}`;

    const { error } = await supabase.storage
      .from('media')
      .upload(filePath, file);

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async () => {
    if ((!content.trim() && !imageFile && !videoFile) || !profile) return;

    setIsLoading(true);

    let imageUrl: string | null = null;
    let videoUrl: string | null = null;

    try {
      if (imageFile) {
        imageUrl = await uploadFile(imageFile, 'image');
        if (!imageUrl) {
          throw new Error('فشل في رفع الصورة');
        }
      }

      if (videoFile) {
        videoUrl = await uploadFile(videoFile, 'video');
        if (!videoUrl) {
          throw new Error('فشل في رفع الفيديو');
        }
      }

      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: profile.id,
          content: content.trim() || null,
          image_url: imageUrl,
          video_url: videoUrl,
          visibility,
        });

      if (error) throw error;

      setContent('');
      clearMedia();
      setVisibility('everyone');
      onPostCreated();
      toast({
        title: 'تم النشر!',
        description: 'تم نشر منشورك بنجاح',
      });
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في نشر المنشور',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getVisibilityIcon = () => {
    switch (visibility) {
      case 'everyone':
        return <Globe className="h-4 w-4" />;
      case 'friends':
        return <Users className="h-4 w-4" />;
      case 'only_me':
        return <Lock className="h-4 w-4" />;
    }
  };

  return (
    <Card className="shadow-sm" dir="rtl">
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {profile?.username?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Textarea
              placeholder={`ماذا يدور في ذهنك، ${profile?.full_name || profile?.username}؟`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[80px] resize-none border-0 bg-muted focus-visible:ring-0 text-base"
            />

            {/* Media Preview */}
            {(imagePreview || videoPreview) && (
              <div className="relative mt-3 rounded-lg overflow-hidden">
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full"
                  onClick={clearMedia}
                >
                  <X className="h-4 w-4" />
                </Button>
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full max-h-80 object-cover rounded-lg"
                  />
                )}
                {videoPreview && (
                  <video
                    src={videoPreview}
                    className="w-full max-h-80 object-cover rounded-lg"
                    controls
                  />
                )}
              </div>
            )}

            <div className="flex items-center justify-between mt-3 pt-3 border-t">
              <div className="flex gap-2">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => imageInputRef.current?.click()}
                >
                  <Image className="h-5 w-5 ml-2" />
                  <span className="hidden sm:inline">صورة</span>
                </Button>
                
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleVideoSelect}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => videoInputRef.current?.click()}
                >
                  <Video className="h-5 w-5 ml-2" />
                  <span className="hidden sm:inline">فيديو</span>
                </Button>
                
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <Smile className="h-5 w-5 ml-2" />
                  <span className="hidden sm:inline">مشاعر</span>
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Select value={visibility} onValueChange={(v: any) => setVisibility(v)}>
                  <SelectTrigger className="w-[130px] h-9">
                    <div className="flex items-center gap-2">
                      {getVisibilityIcon()}
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyone">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        الجميع
                      </div>
                    </SelectItem>
                    <SelectItem value="friends">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        الأصدقاء
                      </div>
                    </SelectItem>
                    <SelectItem value="only_me">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        أنا فقط
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  onClick={handleSubmit}
                  disabled={(!content.trim() && !imageFile && !videoFile) || isLoading}
                  size="sm"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  ) : (
                    <Send className="h-4 w-4 ml-2" />
                  )}
                  نشر
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
