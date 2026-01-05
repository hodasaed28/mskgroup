import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Image, Video, Smile, Send } from 'lucide-react';
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
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!content.trim() || !profile) return;

    setIsLoading(true);
    const { error } = await supabase
      .from('posts')
      .insert({
        user_id: profile.id,
        content: content.trim(),
      });

    setIsLoading(false);

    if (error) {
      toast({
        title: 'خطأ',
        description: 'فشل في نشر المنشور',
        variant: 'destructive',
      });
    } else {
      setContent('');
      onPostCreated();
      toast({
        title: 'تم النشر!',
        description: 'تم نشر منشورك بنجاح',
      });
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
            <div className="flex items-center justify-between mt-3 pt-3 border-t">
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <Image className="h-5 w-5 ml-2" />
                  <span className="hidden sm:inline">صورة</span>
                </Button>
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <Video className="h-5 w-5 ml-2" />
                  <span className="hidden sm:inline">فيديو</span>
                </Button>
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <Smile className="h-5 w-5 ml-2" />
                  <span className="hidden sm:inline">مشاعر</span>
                </Button>
              </div>
              <Button 
                onClick={handleSubmit} 
                disabled={!content.trim() || isLoading}
                size="sm"
              >
                <Send className="h-4 w-4 ml-2" />
                نشر
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
