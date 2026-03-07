import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Home, Users, MessageCircle, Bell, Search, LogOut, User, Settings, Film } from 'lucide-react';
import { Profile } from '@/types/database';
import { LanguageSelector } from '@/components/LanguageSelector';
import { ThemeToggle } from '@/components/ThemeToggle';

interface HeaderProps {
  profile: Profile | null;
  notificationCount: number;
  messageCount: number;
  onMessagesClick: () => void;
}

export default function Header({ profile, notificationCount, messageCount, onMessagesClick }: HeaderProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/reels', icon: Film, label: 'Reels' },
    { path: '/friends', icon: Users, label: 'Friends' },
  ];

  return (
    <header className="sticky top-0 z-50 glass-strong shadow-card" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-glow transition-all duration-300 group-hover:shadow-glow-lg group-hover:scale-105">
            <span className="text-primary-foreground font-extrabold text-lg tracking-tight">M</span>
          </div>
          <span className="hidden sm:block font-bold text-lg gradient-text">MSK</span>
        </Link>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-md hidden md:block">
          <div className="relative group">
            <Search className={`absolute ${isRTL ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary`} />
            <Input
              placeholder={t('nav.search')}
              className={`${isRTL ? 'pr-10' : 'pl-10'} bg-muted/60 border-0 h-10 rounded-xl focus:bg-card focus:shadow-card transition-all duration-300`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </form>

        {/* Navigation */}
        <nav className="flex items-center gap-0.5">
          {navItems.map(({ path, icon: Icon }) => (
            <Button
              key={path}
              variant="ghost"
              size="icon"
              className={`relative rounded-xl transition-all duration-200 ${
                isActive(path) 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
              }`}
              asChild
            >
              <Link to={path}>
                <Icon className="h-5 w-5" />
                {isActive(path) && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-0.5 gradient-primary rounded-full" />
                )}
              </Link>
            </Button>
          ))}

          {/* Messages */}
          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200"
            onClick={onMessagesClick}
          >
            <MessageCircle className="h-5 w-5" />
            {messageCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 gradient-primary text-primary-foreground text-[10px] font-bold rounded-full h-[18px] min-w-[18px] flex items-center justify-center px-1 shadow-glow animate-scale-in">
                {messageCount > 9 ? '9+' : messageCount}
              </span>
            )}
          </Button>

          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            className={`relative rounded-xl transition-all duration-200 ${
              isActive('/notifications')
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
            }`}
            asChild
          >
            <Link to="/notifications">
              <Bell className="h-5 w-5" />
              {notificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 gradient-primary text-primary-foreground text-[10px] font-bold rounded-full h-[18px] min-w-[18px] flex items-center justify-center px-1 shadow-glow animate-scale-in">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </Link>
          </Button>

          <div className="w-px h-6 bg-border mx-1 hidden sm:block" />

          <ThemeToggle />
          <LanguageSelector />

          {/* Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl">
                <Avatar className="h-8 w-8 ring-2 ring-primary/20 transition-all duration-300 hover:ring-primary/50">
                  <AvatarImage src={profile?.avatar_url || ''} />
                  <AvatarFallback className="gradient-primary text-primary-foreground text-sm font-bold">
                    {profile?.username?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="w-56 glass-strong rounded-xl p-1">
              <DropdownMenuItem asChild className="rounded-lg">
                <Link to={`/profile/${profile?.id}`} className="flex items-center gap-2.5 py-2">
                  <User className="h-4 w-4 text-muted-foreground" /><span>{t('nav.profile')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="rounded-lg">
                <Link to="/settings" className="flex items-center gap-2.5 py-2">
                  <Settings className="h-4 w-4 text-muted-foreground" /><span>{t('nav.settings')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive rounded-lg py-2">
                <LogOut className={`h-4 w-4 ${isRTL ? 'ml-2.5' : 'mr-2.5'}`} /><span>{t('nav.logout')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>
    </header>
  );
}
