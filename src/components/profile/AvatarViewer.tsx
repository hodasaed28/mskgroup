import { useState } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Camera, Eye, PlayCircle, X, Upload } from 'lucide-react';
import { Profile } from '@/types/database';

interface AvatarViewerProps {
  profile: Profile;
  isOwnProfile: boolean;
  hasStory?: boolean;
  onViewStory?: () => void;
  onChangePhoto?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export default function AvatarViewer({ 
  profile, 
  isOwnProfile, 
  hasStory = false,
  onViewStory,
  onChangePhoto,
  size = 'lg'
}: AvatarViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const sizeClasses = {
    sm: 'h-12 w-12',
    md: 'h-20 w-20',
    lg: 'h-32 w-32 md:h-40 md:w-40'
  };

  const handleAvatarClick = () => {
    if (isOwnProfile || hasStory || profile.avatar_url) {
      setShowOptions(true);
    }
  };

  const handleViewPhoto = () => {
    setShowOptions(false);
    setIsOpen(true);
  };

  const handleViewStory = () => {
    setShowOptions(false);
    onViewStory?.();
  };

  const handleChangePhoto = () => {
    setShowOptions(false);
    onChangePhoto?.();
  };

  return (
    <>
      {/* Options Dialog */}
      <Dialog open={showOptions} onOpenChange={setShowOptions}>
        <DialogTrigger asChild>
          <div 
            className={`relative cursor-pointer group ${hasStory ? 'ring-4 ring-primary ring-offset-2 ring-offset-background rounded-full' : ''}`}
            onClick={handleAvatarClick}
          >
            <Avatar className={`${sizeClasses[size]} border-4 border-background`}>
              <AvatarImage src={profile.avatar_url || ''} />
              <AvatarFallback className="text-4xl bg-primary text-primary-foreground">
                {profile.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {isOwnProfile && size === 'lg' && (
              <Button 
                variant="secondary" 
                size="icon" 
                className="absolute bottom-2 left-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); handleChangePhoto(); }}
              >
                <Camera className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogTrigger>
        <DialogContent className="sm:max-w-xs" dir="rtl">
          <div className="flex flex-col gap-2 p-2">
            {profile.avatar_url && (
              <Button 
                variant="ghost" 
                className="w-full justify-start gap-3"
                onClick={handleViewPhoto}
              >
                <Eye className="h-5 w-5" />
                عرض الصورة
              </Button>
            )}
            {hasStory && (
              <Button 
                variant="ghost" 
                className="w-full justify-start gap-3"
                onClick={handleViewStory}
              >
                <PlayCircle className="h-5 w-5" />
                عرض القصة
              </Button>
            )}
            {isOwnProfile && (
              <Button 
                variant="ghost" 
                className="w-full justify-start gap-3"
                onClick={handleChangePhoto}
              >
                <Upload className="h-5 w-5" />
                تغيير الصورة
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Full View Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl bg-black/90 border-0 p-0">
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-6 w-6" />
          </Button>
          <div className="flex items-center justify-center min-h-[60vh]">
            {profile.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt={profile.full_name || profile.username}
                className="max-w-full max-h-[80vh] object-contain"
              />
            ) : (
              <div className="w-64 h-64 rounded-full bg-primary flex items-center justify-center">
                <span className="text-8xl text-primary-foreground font-bold">
                  {profile.username.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="p-4 text-center text-white">
            <p className="font-semibold text-lg">{profile.full_name || profile.username}</p>
            <p className="text-white/70">@{profile.username}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}