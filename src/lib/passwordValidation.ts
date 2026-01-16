import { z } from 'zod';

// Common leaked passwords list (top 100 most common)
const COMMON_PASSWORDS = new Set([
  '123456', 'password', '123456789', '12345678', '12345', '1234567', '1234567890',
  'qwerty', 'abc123', 'million2', '000000', '1234', 'iloveyou', 'aaron431',
  'password1', 'qqww1122', '123', 'omgpop', '123321', '654321', 'qwertyuiop',
  'qwerty123', '1q2w3e4r', 'admin', 'qwe123', '1q2w3e', 'letmein', '0', 'monkey',
  '111111', 'dragon', 'master', 'sunshine', 'princess', 'football', 'baseball',
  'trustno1', 'hello', 'charlie', 'welcome', 'shadow', 'superman', 'michael',
  'ninja', 'mustang', 'jessica', 'passw0rd', 'lovely', 'solo', '123123',
  'ashley', '888888', 'login', 'starwars', 'qwer1234', 'pass123', '121212',
  'flower', 'hottie', 'love123', 'zaq12wsx', 'whatever', 'photoshop', 'test',
  'password123', 'welcome1', 'princess1', 'sunshine1', 'michael1', 'charlie1',
  'password2', 'iloveyou1', 'jennifer', 'computer', 'michelle', 'jordan', 'maggie',
  'soccer', 'killer', 'pepper', 'summer', 'amanda', 'access', 'thunder', 'knight',
  'ginger', 'tigger', 'thomas', 'nicole', 'matthew', 'andrew', 'cookie', 'george',
  'summer1', 'winter', 'spring', 'autumn', 'password!', 'letmein1', 'abc1234',
]);

// Check if password contains common patterns
const hasCommonPattern = (password: string): boolean => {
  const lowerPassword = password.toLowerCase();
  
  // Check for common leaked passwords
  if (COMMON_PASSWORDS.has(lowerPassword)) {
    return true;
  }
  
  // Check for keyboard patterns
  const keyboardPatterns = [
    'qwerty', 'asdf', 'zxcv', '1234', '4321', 'abcd', 'dcba',
    'qazwsx', 'wsxedc', 'password', 'admin', 'login', 'welcome'
  ];
  
  for (const pattern of keyboardPatterns) {
    if (lowerPassword.includes(pattern)) {
      return true;
    }
  }
  
  // Check for repeated characters (more than 3 in a row)
  if (/(.)\1{3,}/.test(password)) {
    return true;
  }
  
  return false;
};

// Password strength levels
export type PasswordStrength = 'weak' | 'medium' | 'strong' | 'very_strong';

export interface PasswordValidationResult {
  isValid: boolean;
  strength: PasswordStrength;
  errors: string[];
  suggestions: string[];
}

// Validate password complexity
export const validatePassword = (password: string): PasswordValidationResult => {
  const errors: string[] = [];
  const suggestions: string[] = [];
  
  // Minimum length
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  
  // Maximum length
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }
  
  // Has uppercase
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  // Has lowercase
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  // Has number
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  // Check for leaked/common passwords
  if (hasCommonPattern(password)) {
    errors.push('This password is too common or contains predictable patterns');
    suggestions.push('Try using a unique phrase or random characters');
  }
  
  // Calculate strength
  let strength: PasswordStrength = 'weak';
  let score = 0;
  
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (!hasCommonPattern(password)) score++;
  
  if (score >= 7) strength = 'very_strong';
  else if (score >= 5) strength = 'strong';
  else if (score >= 3) strength = 'medium';
  else strength = 'weak';
  
  // Suggestions for improving password
  if (!/[^A-Za-z0-9]/.test(password) && errors.length === 0) {
    suggestions.push('Adding special characters (!@#$%^&*) will make your password stronger');
  }
  
  if (password.length < 12 && errors.length === 0) {
    suggestions.push('Longer passwords are more secure - try using 12+ characters');
  }
  
  return {
    isValid: errors.length === 0,
    strength,
    errors,
    suggestions,
  };
};

// Zod schema for password validation
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .refine(
    (password) => !hasCommonPattern(password),
    'This password is too common or contains predictable patterns'
  );

// Get password strength color
export const getPasswordStrengthColor = (strength: PasswordStrength): string => {
  switch (strength) {
    case 'very_strong':
      return 'bg-green-500';
    case 'strong':
      return 'bg-blue-500';
    case 'medium':
      return 'bg-yellow-500';
    default:
      return 'bg-red-500';
  }
};

// Get password strength label
export const getPasswordStrengthLabel = (strength: PasswordStrength): string => {
  switch (strength) {
    case 'very_strong':
      return 'Very Strong';
    case 'strong':
      return 'Strong';
    case 'medium':
      return 'Medium';
    default:
      return 'Weak';
  }
};
