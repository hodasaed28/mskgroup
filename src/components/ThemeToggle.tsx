import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Theme = 'light' | 'dark' | 'system';

interface ThemeToggleProps {
  variant?: 'dropdown' | 'buttons';
  className?: string;
}

export function ThemeToggle({ variant = 'dropdown', className }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>('light');
  const { t } = useTranslation();

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme) {
      setTheme(savedTheme);
      applyTheme(savedTheme);
    } else {
      // Default to system
      setTheme('system');
      applyTheme('system');
    }
  }, []);

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    if (newTheme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', systemDark);
    } else {
      root.classList.toggle('dark', newTheme === 'dark');
    }
    localStorage.setItem('theme', newTheme);
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  const getCurrentIcon = () => {
    switch (theme) {
      case 'dark':
        return <Moon className="h-4 w-4" />;
      case 'light':
        return <Sun className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  if (variant === 'buttons') {
    return (
      <div className={`flex gap-2 flex-wrap ${className}`}>
        <Button
          variant={theme === 'light' ? 'default' : 'outline'}
          onClick={() => handleThemeChange('light')}
          className="flex-1 min-w-[100px]"
          size="sm"
        >
          <Sun className="h-4 w-4 mr-2" />
          {t('settings.lightMode')}
        </Button>
        <Button
          variant={theme === 'dark' ? 'default' : 'outline'}
          onClick={() => handleThemeChange('dark')}
          className="flex-1 min-w-[100px]"
          size="sm"
        >
          <Moon className="h-4 w-4 mr-2" />
          {t('settings.darkMode')}
        </Button>
        <Button
          variant={theme === 'system' ? 'default' : 'outline'}
          onClick={() => handleThemeChange('system')}
          className="flex-1 min-w-[100px]"
          size="sm"
        >
          <Monitor className="h-4 w-4 mr-2" />
          {t('settings.systemTheme')}
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={className}>
          {getCurrentIcon()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleThemeChange('light')} className="gap-2">
          <Sun className="h-4 w-4" />
          {t('settings.lightMode')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleThemeChange('dark')} className="gap-2">
          <Moon className="h-4 w-4" />
          {t('settings.darkMode')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleThemeChange('system')} className="gap-2">
          <Monitor className="h-4 w-4" />
          {t('settings.systemTheme')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
