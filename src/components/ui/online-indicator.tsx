import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface OnlineIndicatorProps {
  isOnline?: boolean;
  lastSeen?: string | null;
  showDot?: boolean;
  showText?: boolean;
  className?: string;
}

export function OnlineIndicator({ 
  isOnline, 
  lastSeen, 
  showDot = true, 
  showText = false,
  className = ''
}: OnlineIndicatorProps) {
  const getStatusText = () => {
    if (isOnline) {
      return 'متصل الآن';
    }
    if (lastSeen) {
      return `آخر ظهور ${formatDistanceToNow(new Date(lastSeen), { addSuffix: true, locale: ar })}`;
    }
    return 'غير متصل';
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {showDot && (
        <span 
          className={`w-2.5 h-2.5 rounded-full ${
            isOnline ? 'bg-green-500' : 'bg-gray-400'
          }`}
        />
      )}
      {showText && (
        <span className={`text-xs ${isOnline ? 'text-green-600' : 'text-muted-foreground'}`}>
          {getStatusText()}
        </span>
      )}
    </div>
  );
}