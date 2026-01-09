import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Image, Video, X, Loader2 } from 'lucide-react';
import { Profile } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CreateStoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: Profile | null;
  onStoryCreated: () => void;
}

export default function CreateStoryDialog({ 
  open, 
  onOpenChange, 
  currentUser,
  onStoryCreated 
}: CreateStoryDialogProps) {
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (file) {
      const maxSize = type === 'image' ? 10 : 50;
      if (file.size > maxSize * 1024 * 1024) {
        toast({
          title: 'خطأ',
          description: `حجم الملف يجب أن يكون أقل من ${maxSize}MB`,
          variant: 'destructive',
        });
        return;
      }
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
      setMediaType(type);
    }
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!mediaFile || !currentUser) return;

    setIsLoading(true);

    try {
      const fileExt = mediaFile.name.split('.').pop();
      const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
      const filePath = `stories/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, mediaFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from('stories')
        .insert({
          user_id: currentUser.id,
          media_url: publicUrl,
          media_type: mediaType,
          caption: caption.trim() || null,
        });

      if (insertError) throw insertError;

      toast({
        title: 'تم النشر',
        description: 'تم نشر القصة بنجاح',
      });

      clearMedia();
      setCaption('');
      onOpenChange(false);
      onStoryCreated();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل نشر القصة',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>إنشاء قصة جديدة</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!mediaPreview ? (
            <div className="flex gap-4 justify-center py-8">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileSelect(e, 'image')}
              />
              <Button
                variant="outline"
                size="lg"
                onClick={() => imageInputRef.current?.click()}
                className="flex flex-col gap-2 h-24 w-24"
              >
                <Image className="h-8 w-8" />
                <span className="text-xs">صورة</span>
              </Button>

              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => handleFileSelect(e, 'video')}
              />
              <Button
                variant="outline"
                size="lg"
                onClick={() => videoInputRef.current?.click()}
                className="flex flex-col gap-2 h-24 w-24"
              >
                <Video className="h-8 w-8" />
                <span className="text-xs">فيديو</span>
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full"
                onClick={clearMedia}
              >
                <X className="h-4 w-4" />
              </Button>
              {mediaType === 'image' ? (
                <img
                  src={mediaPreview}
                  alt="Preview"
                  className="w-full max-h-80 object-contain rounded-lg bg-muted"
                />
              ) : (
                <video
                  src={mediaPreview}
                  className="w-full max-h-80 object-contain rounded-lg bg-muted"
                  controls
                />
              )}
            </div>
          )}

          {mediaPreview && (
            <>
              <Textarea
                placeholder="أضف تعليقاً..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="resize-none"
                rows={2}
              />

              <Button 
                onClick={handleSubmit} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    جاري النشر...
                  </>
                ) : (
                  'نشر القصة'
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}