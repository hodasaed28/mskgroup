import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Image, X, Loader2, Globe, Users, Lock } from 'lucide-react';
import { Post, Profile } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EditPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: Post;
  currentUser: Profile | null;
  onPostUpdated: () => void;
}

export default function EditPostDialog({ 
  open, 
  onOpenChange, 
  post,
  currentUser,
  onPostUpdated 
}: EditPostDialogProps) {
  const [content, setContent] = useState(post.content || '');
  const [visibility, setVisibility] = useState<'everyone' | 'friends' | 'only_me'>(post.visibility);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(post.image_url);
  const [removeImage, setRemoveImage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'خطأ',
          description: 'حجم الصورة يجب أن يكون أقل من 10MB',
          variant: 'destructive',
        });
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setRemoveImage(false);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const uploadFile = async (file: File) => {
    if (!currentUser) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
    const filePath = `images/${fileName}`;

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
    if (!content.trim() && !imagePreview) {
      toast({
        title: 'خطأ',
        description: 'المنشور يجب أن يحتوي على محتوى أو صورة',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      let imageUrl = post.image_url;

      if (removeImage) {
        imageUrl = null;
      } else if (imageFile) {
        imageUrl = await uploadFile(imageFile);
        if (!imageUrl) {
          throw new Error('فشل رفع الصورة');
        }
      }

      const { error } = await supabase
        .from('posts')
        .update({
          content: content.trim() || null,
          image_url: imageUrl,
          visibility,
        })
        .eq('id', post.id);

      if (error) throw error;

      toast({
        title: 'تم التحديث',
        description: 'تم تحديث المنشور بنجاح',
      });

      onOpenChange(false);
      onPostUpdated();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل تحديث المنشور',
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>تعديل المنشور</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            placeholder="ماذا يدور في ذهنك؟"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[120px] resize-none"
          />

          {imagePreview && (
            <div className="relative">
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full"
                onClick={clearImage}
              >
                <X className="h-4 w-4" />
              </Button>
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full max-h-60 object-cover rounded-lg"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => imageInputRef.current?.click()}
              >
                <Image className="h-4 w-4 ml-2" />
                {imagePreview ? 'تغيير الصورة' : 'إضافة صورة'}
              </Button>
            </div>

            <Select value={visibility} onValueChange={(v: any) => setVisibility(v)}>
              <SelectTrigger className="w-[130px]">
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
          </div>

          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || (!content.trim() && !imagePreview)}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                جاري التحديث...
              </>
            ) : (
              'حفظ التغييرات'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}