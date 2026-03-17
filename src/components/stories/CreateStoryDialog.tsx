import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/useLanguage';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Image, Video, X, Loader2, Type } from 'lucide-react';
import { Profile } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CreateStoryDialogProps { open: boolean; onOpenChange: (open: boolean) => void; currentUser: Profile | null; onStoryCreated: () => void; }

const BG_COLORS = [
  'bg-gradient-to-br from-purple-600 to-pink-500', 'bg-gradient-to-br from-blue-600 to-cyan-500',
  'bg-gradient-to-br from-green-600 to-emerald-500', 'bg-gradient-to-br from-orange-600 to-yellow-500',
  'bg-gradient-to-br from-red-600 to-rose-500', 'bg-gradient-to-br from-indigo-600 to-violet-500',
  'bg-gradient-to-br from-teal-600 to-cyan-400', 'bg-gradient-to-br from-fuchsia-600 to-pink-400',
];

type StoryMode = 'select' | 'media' | 'text';

export default function CreateStoryDialog({ open, onOpenChange, currentUser, onStoryCreated }: CreateStoryDialogProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [storyMode, setStoryMode] = useState<StoryMode>('select');
  const [textContent, setTextContent] = useState('');
  const [selectedBg, setSelectedBg] = useState(0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (file) {
      const maxSize = type === 'image' ? 10 : 50;
      if (file.size > maxSize * 1024 * 1024) {
        toast({ title: t('common.error'), description: t('stories.fileTooLarge', { size: maxSize }), variant: 'destructive' });
        return;
      }
      setMediaFile(file); setMediaPreview(URL.createObjectURL(file)); setMediaType(type); setStoryMode('media');
    }
  };

  const clearMedia = () => { setMediaFile(null); setMediaPreview(null); setStoryMode('select'); if (imageInputRef.current) imageInputRef.current.value = ''; if (videoInputRef.current) videoInputRef.current.value = ''; };

  const handleSubmitMedia = async () => {
    if (!mediaFile || !currentUser) return;
    setIsLoading(true);
    try {
      const fileExt = mediaFile.name.split('.').pop();
      const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
      const filePath = `stories/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('media').upload(filePath, mediaFile);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);
      const { error: insertError } = await supabase.from('stories').insert({ user_id: currentUser.id, media_url: publicUrl, media_type: mediaType, caption: caption.trim() || null });
      if (insertError) throw insertError;
      toast({ title: t('common.success'), description: t('stories.published') });
      clearMedia(); setCaption(''); onOpenChange(false); onStoryCreated();
    } catch (error: any) { toast({ title: t('common.error'), description: error.message, variant: 'destructive' }); }
    finally { setIsLoading(false); }
  };

  const handleSubmitText = async () => {
    if (!textContent.trim() || !currentUser) return;
    setIsLoading(true);
    try {
      const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1920;
      const ctx = canvas.getContext('2d')!;
      const gradients: [string, string][] = [['#9333ea','#ec4899'],['#2563eb','#06b6d4'],['#16a34a','#10b981'],['#ea580c','#eab308'],['#dc2626','#f43f5e'],['#4f46e5','#8b5cf6'],['#0d9488','#22d3ee'],['#c026d3','#f472b6']];
      const [c1, c2] = gradients[selectedBg];
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height); gradient.addColorStop(0, c1); gradient.addColorStop(1, c2);
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const fontSize = Math.min(80, 1000 / Math.max(textContent.length / 3, 1));
      ctx.font = `bold ${fontSize}px sans-serif`;
      const words = textContent.split(' '); const lines: string[] = []; let currentLine = '';
      for (const word of words) { const test = currentLine ? `${currentLine} ${word}` : word; if (ctx.measureText(test).width > canvas.width * 0.8) { lines.push(currentLine); currentLine = word; } else { currentLine = test; } }
      if (currentLine) lines.push(currentLine);
      const lineHeight = fontSize * 1.4; const startY = canvas.height / 2 - (lines.length - 1) * lineHeight / 2;
      lines.forEach((line, i) => { ctx.fillText(line, canvas.width / 2, startY + i * lineHeight); });
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
      const fileName = `${currentUser.id}/${Date.now()}.png`; const filePath = `stories/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('media').upload(filePath, blob); if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);
      const { error: insertError } = await supabase.from('stories').insert({ user_id: currentUser.id, media_url: publicUrl, media_type: 'image', caption: textContent.trim() }); if (insertError) throw insertError;
      toast({ title: t('common.success'), description: t('stories.published') });
      setTextContent(''); setStoryMode('select'); onOpenChange(false); onStoryCreated();
    } catch (error: any) { toast({ title: t('common.error'), description: error.message, variant: 'destructive' }); }
    finally { setIsLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader><DialogTitle>{t('stories.createStory')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {storyMode === 'select' && (
            <div className="flex gap-4 justify-center py-8">
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'image')} />
              <Button variant="outline" size="lg" onClick={() => imageInputRef.current?.click()} className="flex flex-col gap-2 h-24 w-24"><Image className="h-8 w-8" /><span className="text-xs">{t('stories.image')}</span></Button>
              <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleFileSelect(e, 'video')} />
              <Button variant="outline" size="lg" onClick={() => videoInputRef.current?.click()} className="flex flex-col gap-2 h-24 w-24"><Video className="h-8 w-8" /><span className="text-xs">{t('stories.video')}</span></Button>
              <Button variant="outline" size="lg" onClick={() => setStoryMode('text')} className="flex flex-col gap-2 h-24 w-24"><Type className="h-8 w-8" /><span className="text-xs">{t('stories.text')}</span></Button>
            </div>
          )}
          {storyMode === 'text' && (
            <>
              <div className={`relative rounded-lg aspect-[9/16] max-h-80 ${BG_COLORS[selectedBg]} flex items-center justify-center p-8`}>
                <p className="text-white text-center text-lg font-bold break-words max-w-full">{textContent || t('stories.writeText')}</p>
              </div>
              <div className="flex gap-2 justify-center flex-wrap">{BG_COLORS.map((bg, i) => (<button key={i} className={`w-8 h-8 rounded-full ${bg} ${selectedBg === i ? 'ring-2 ring-primary ring-offset-2' : ''}`} onClick={() => setSelectedBg(i)} />))}</div>
              <Textarea placeholder={t('stories.storyTextPlaceholder')} value={textContent} onChange={(e) => setTextContent(e.target.value)} className="resize-none" rows={2} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setStoryMode('select'); setTextContent(''); }} className="flex-1">{t('common.back')}</Button>
                <Button onClick={handleSubmitText} disabled={isLoading || !textContent.trim()} className="flex-1">
                  {isLoading ? <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} /> : null}{t('stories.publish')}
                </Button>
              </div>
            </>
          )}
          {storyMode === 'media' && mediaPreview && (
            <>
              <div className="relative">
                <Button variant="secondary" size="icon" className={`absolute top-2 z-10 h-8 w-8 rounded-full ${isRTL ? 'right-2' : 'left-2'}`} onClick={clearMedia}><X className="h-4 w-4" /></Button>
                {mediaType === 'image' ? <img src={mediaPreview} alt="Preview" className="w-full max-h-80 object-contain rounded-lg bg-muted" /> : <video src={mediaPreview} className="w-full max-h-80 object-contain rounded-lg bg-muted" controls />}
              </div>
              <Textarea placeholder={t('stories.addCaption')} value={caption} onChange={(e) => setCaption(e.target.value)} className="resize-none" rows={2} />
              <Button onClick={handleSubmitMedia} disabled={isLoading} className="w-full">
                {isLoading ? <><Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />{t('stories.publishing')}</> : t('stories.publish')}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
