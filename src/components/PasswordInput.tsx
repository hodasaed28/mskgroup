import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Check, X, AlertTriangle } from 'lucide-react';
import { validatePassword, getPasswordStrengthColor, getPasswordStrengthLabel, PasswordStrength } from '@/lib/passwordValidation';
import { cn } from '@/lib/utils';

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  showStrength?: boolean;
  showRequirements?: boolean;
  className?: string;
  disabled?: boolean;
}

export function PasswordInput({
  value,
  onChange,
  placeholder = '••••••••',
  id,
  showStrength = false,
  showRequirements = false,
  className,
  disabled = false,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const validation = validatePassword(value);
  
  const requirements = [
    { label: 'At least 8 characters', met: value.length >= 8 },
    { label: 'One uppercase letter (A-Z)', met: /[A-Z]/.test(value) },
    { label: 'One lowercase letter (a-z)', met: /[a-z]/.test(value) },
    { label: 'One number (0-9)', met: /[0-9]/.test(value) },
  ];

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn('pr-10', className)}
          disabled={disabled}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
          onClick={() => setShowPassword(!showPassword)}
          disabled={disabled}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Eye className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </div>

      {/* Strength Indicator */}
      {showStrength && value.length > 0 && (
        <div className="space-y-1">
          <div className="flex gap-1">
            {(['weak', 'medium', 'strong', 'very_strong'] as PasswordStrength[]).map((level, index) => (
              <div
                key={level}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  index <= ['weak', 'medium', 'strong', 'very_strong'].indexOf(validation.strength)
                    ? getPasswordStrengthColor(validation.strength)
                    : 'bg-muted'
                )}
              />
            ))}
          </div>
          <p className={cn(
            'text-xs',
            validation.strength === 'weak' && 'text-red-500',
            validation.strength === 'medium' && 'text-yellow-500',
            validation.strength === 'strong' && 'text-blue-500',
            validation.strength === 'very_strong' && 'text-green-500'
          )}>
            {getPasswordStrengthLabel(validation.strength)}
          </p>
        </div>
      )}

      {/* Requirements List */}
      {showRequirements && value.length > 0 && (
        <div className="space-y-1">
          {requirements.map((req, index) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              {req.met ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <X className="h-3 w-3 text-muted-foreground" />
              )}
              <span className={req.met ? 'text-green-500' : 'text-muted-foreground'}>
                {req.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {validation.errors.filter(e => e.includes('common') || e.includes('predictable')).length > 0 && (
        <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>This password appears in leaked password databases. Please choose a different password.</span>
        </div>
      )}

      {/* Suggestions */}
      {validation.suggestions.length > 0 && validation.isValid && (
        <div className="text-xs text-muted-foreground">
          💡 {validation.suggestions[0]}
        </div>
      )}
    </div>
  );
}
