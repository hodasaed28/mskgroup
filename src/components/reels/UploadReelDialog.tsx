import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Upload, Film } from 'lucide-react';

interface UploadReelDialogProps { open: boolean; onOpenChange: (open: boolean) => void; profileId: string; onUploaded: () => void; }

export function UploadReelDialog({ open, onOpenChange, profileId, onUploaded }: UploadReelDialogProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) { toast({ title: t('common.error'), description: t('reels.videoTooLarge'), variant: 'destructive' }); return; }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${profileId}/${Date.now()}.${fileExt}`;
      const filePath = `reels/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('media').upload(filePath, selectedFile); if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);
      const { error: insertError } = await supabase.from('reels').insert({ user_id: profileId, video_url: publicUrl, caption: caption.trim() || null }); if (insertError) throw insertError;
      toast({ title: t('reels.published') });
      onOpenChange(false); setSelectedFile(null); setCaption(''); onUploaded();
    } catch (error: any) { toast({ title: t('common.error'), description: error.message || t('reels.publishFailed'), variant: 'destructive' }); }
    finally { setIsUploading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="sm:max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Film className="h-5 w-5 text-primary" />{t('reels.uploadNew')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileSelect} />
          {selectedFile ? (
            <div className="space-y-2"><video src={URL.createObjectURL(selectedFile)} className="w-full h-52 object-cover rounded-xl" controls /><p className="text-sm text-muted-foreground truncate">{selectedFile.name}</p></div>
          ) : (
            <button className="w-full h-40 border-2 border-dashed border-muted-foreground/30 rounded-xl flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-all" onClick={() => videoInputRef.current?.click()}>
              <Upload className="h-8 w-8 text-muted-foreground" /><span className="text-muted-foreground text-sm">{t('reels.selectVideo')}</span>
            </button>
          )}
          <Textarea placeholder={t('reels.captionPlaceholder')} value={caption} onChange={(e) => setCaption(e.target.value)} className="resize-none" rows={3} />
          <Button className="w-full" onClick={handleUpload} disabled={!selectedFile || isUploading}>
            {isUploading ? (<><Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />{t('reels.uploading')}</>) : t('reels.publishReel')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
