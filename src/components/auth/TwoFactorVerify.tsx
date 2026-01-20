import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Loader2, Shield, ArrowLeft } from 'lucide-react';
import * as OTPAuth from 'otpauth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';

interface TwoFactorVerifyProps {
  userId: string;
  userEmail: string;
  onVerified: () => void;
  onBack: () => void;
}

export function TwoFactorVerify({ userId, userEmail, onVerified, onBack }: TwoFactorVerifyProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);

  const handleVerify = async () => {
    if (verificationCode.length < 6) return;

    setLoading(true);
    try {
      const savedSecret = localStorage.getItem(`2fa_secret_${userId}`);
      
      if (!savedSecret) {
        toast({
          title: t('common.error'),
          description: '2FA configuration not found. Please contact support.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      let isValid = false;

      if (useBackupCode) {
        // Check backup codes
        const backupCodesStr = localStorage.getItem(`2fa_backup_${userId}`);
        const storedBackupCodes: string[] = backupCodesStr ? JSON.parse(backupCodesStr) : [];
        const codeIndex = storedBackupCodes.findIndex(
          code => code.toUpperCase() === verificationCode.toUpperCase()
        );
        
        if (codeIndex !== -1) {
          isValid = true;
          // Remove used backup code
          storedBackupCodes.splice(codeIndex, 1);
          localStorage.setItem(`2fa_backup_${userId}`, JSON.stringify(storedBackupCodes));
          
          toast({
            title: 'Backup code used',
            description: `${storedBackupCodes.length} backup codes remaining.`,
          });
        }
      } else {
        // Verify TOTP code
        const totp = new OTPAuth.TOTP({
          issuer: 'MSK Group',
          label: userEmail,
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
          secret: OTPAuth.Secret.fromBase32(savedSecret),
        });

        isValid = totp.validate({ token: verificationCode, window: 1 }) !== null;
      }

      if (!isValid) {
        toast({
          title: t('common.error'),
          description: useBackupCode 
            ? 'Invalid backup code. Please try again.' 
            : 'Invalid verification code. Please try again.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Success!
      toast({
        title: 'Verified!',
        description: 'Two-factor authentication successful.',
      });
      
      onVerified();
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || 'Verification failed',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-xl border-0">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-xl">Two-Factor Authentication</CardTitle>
        <CardDescription>
          {useBackupCode 
            ? 'Enter one of your backup codes'
            : 'Enter the 6-digit code from your authenticator app'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center" dir="ltr">
          <InputOTP
            value={verificationCode}
            onChange={setVerificationCode}
            maxLength={6}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button
          onClick={handleVerify}
          disabled={loading || verificationCode.length < 6}
          className="w-full"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Verify
        </Button>

        <div className="text-center space-y-2">
          <Button
            variant="link"
            onClick={() => {
              setUseBackupCode(!useBackupCode);
              setVerificationCode('');
            }}
          >
            {useBackupCode ? 'Use authenticator app instead' : 'Use a backup code'}
          </Button>
          
          <div>
            <Button
              variant="ghost"
              onClick={onBack}
              className="text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to login
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
