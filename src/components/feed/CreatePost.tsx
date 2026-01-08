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
import { Image, Video, Send, X, Globe, Users, Lock, Loader2 } from 'lucide-react';
import { Profile } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/useLanguage';
import { EmojiPicker } from '@/components/ui/emoji-picker';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.slice(0, start) + emoji + content.slice(end);
      setContent(newContent);
      // Set cursor position after emoji
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      }, 0);
    } else {
      setContent(content + emoji);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: t('common.error'),
          description: 'Image must be less than 10MB',
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
          title: t('common.error'),
          description: 'Video must be less than 50MB',
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
          throw new Error('Failed to upload image');
        }
      }

      if (videoFile) {
        videoUrl = await uploadFile(videoFile, 'video');
        if (!videoUrl) {
          throw new Error('Failed to upload video');
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
        title: t('common.success'),
        description: 'Post published successfully',
      });
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || 'Failed to publish post',
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
    <Card className="shadow-sm" dir={isRTL ? 'rtl' : 'ltr'}>
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
              ref={textareaRef}
              placeholder={`What's on your mind, ${profile?.full_name || profile?.username}?`}
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
                  className={`absolute top-2 z-10 h-8 w-8 rounded-full ${isRTL ? 'right-2' : 'left-2'}`}
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
              <div className="flex gap-1">
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
                  <Image className="h-5 w-5" />
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
                  <Video className="h-5 w-5" />
                </Button>
                
                <EmojiPicker onEmojiSelect={handleEmojiSelect} />
              </div>

              <div className="flex items-center gap-2">
                <Select value={visibility} onValueChange={(v: any) => setVisibility(v)}>
                  <SelectTrigger className="w-[110px] h-9">
                    <div className="flex items-center gap-2">
                      {getVisibilityIcon()}
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyone">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Everyone
                      </div>
                    </SelectItem>
                    <SelectItem value="friends">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Friends
                      </div>
                    </SelectItem>
                    <SelectItem value="only_me">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Only me
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
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
