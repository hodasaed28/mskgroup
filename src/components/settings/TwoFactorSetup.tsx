import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Shield, ShieldCheck, ShieldOff, Copy, Check } from 'lucide-react';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';

interface TwoFactorSetupProps {
  userId: string;
  userEmail: string;
  isEnabled: boolean;
  onStatusChange: (enabled: boolean) => void;
}

export function TwoFactorSetup({ userId, userEmail, isEnabled, onStatusChange }: TwoFactorSetupProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [step, setStep] = useState<'qr' | 'verify' | 'backup'>('qr');

  const generateBackupCodes = (): string[] => {
    const codes: string[] = [];
    for (let i = 0; i < 8; i++) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      codes.push(code);
    }
    return codes;
  };

  const handleEnable2FA = async () => {
    setLoading(true);
    try {
      // Generate new TOTP secret
      const totp = new OTPAuth.TOTP({
        issuer: 'MSK Group',
        label: userEmail,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromHex(crypto.getRandomValues(new Uint8Array(20)).reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '')),
      });

      const secretBase32 = totp.secret.base32;
      setSecret(secretBase32);

      // Generate QR code
      const otpauthUrl = totp.toString();
      const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrCodeUrl(qrDataUrl);

      // Generate backup codes
      const codes = generateBackupCodes();
      setBackupCodes(codes);

      setStep('qr');
      setShowSetupDialog(true);
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || 'Failed to initialize 2FA',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndEnable = async () => {
    if (verificationCode.length !== 6) return;

    setLoading(true);
    try {
      // Verify the code
      const totp = new OTPAuth.TOTP({
        issuer: 'MSK Group',
        label: userEmail,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secret),
      });

      const isValid = totp.validate({ token: verificationCode, window: 1 }) !== null;

      if (!isValid) {
        toast({
          title: t('common.error'),
          description: 'Invalid verification code. Please try again.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Save to database - store the secret and backup codes
      // In production, these should be encrypted
      const { error } = await supabase
        .from('profiles')
        .update({
          two_factor_enabled: true,
        } as any)
        .eq('id', userId);

      if (error) throw error;

      // Store secret in localStorage (in production, use secure storage)
      localStorage.setItem(`2fa_secret_${userId}`, secret);
      localStorage.setItem(`2fa_backup_${userId}`, JSON.stringify(backupCodes));

      setStep('backup');
      onStatusChange(true);
      toast({
        title: 'Two-Factor Authentication Enabled',
        description: 'Your account is now more secure.',
      });
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || 'Failed to enable 2FA',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (verificationCode.length !== 6) return;

    setLoading(true);
    try {
      // Verify the code first
      const savedSecret = localStorage.getItem(`2fa_secret_${userId}`);
      if (savedSecret) {
        const totp = new OTPAuth.TOTP({
          issuer: 'MSK Group',
          label: userEmail,
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
          secret: OTPAuth.Secret.fromBase32(savedSecret),
        });

        const isValid = totp.validate({ token: verificationCode, window: 1 }) !== null;

        if (!isValid) {
          // Check backup codes
          const backupCodesStr = localStorage.getItem(`2fa_backup_${userId}`);
          const storedBackupCodes = backupCodesStr ? JSON.parse(backupCodesStr) : [];
          if (!storedBackupCodes.includes(verificationCode.toUpperCase())) {
            toast({
              title: t('common.error'),
              description: 'Invalid verification code.',
              variant: 'destructive',
            });
            setLoading(false);
            return;
          }
        }
      }

      // Disable in database
      const { error } = await supabase
        .from('profiles')
        .update({
          two_factor_enabled: false,
        } as any)
        .eq('id', userId);

      if (error) throw error;

      // Remove stored secrets
      localStorage.removeItem(`2fa_secret_${userId}`);
      localStorage.removeItem(`2fa_backup_${userId}`);

      setShowDisableDialog(false);
      setVerificationCode('');
      onStatusChange(false);
      toast({
        title: 'Two-Factor Authentication Disabled',
        description: 'Your account no longer requires 2FA.',
      });
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || 'Failed to disable 2FA',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    toast({
      title: 'Backup codes copied',
      description: 'Store them in a safe place.',
    });
  };

  const handleCloseSetup = () => {
    if (step === 'backup') {
      // Only allow closing after viewing backup codes
      setShowSetupDialog(false);
      setStep('qr');
      setVerificationCode('');
      setQrCodeUrl('');
      setSecret('');
    } else {
      // Confirm before closing during setup
      if (confirm('Are you sure you want to cancel 2FA setup?')) {
        setShowSetupDialog(false);
        setStep('qr');
        setVerificationCode('');
        setQrCodeUrl('');
        setSecret('');
      }
    }
  };

  return (
    <>
      <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
        <div className="flex items-center gap-3">
          {isEnabled ? (
            <ShieldCheck className="h-5 w-5 text-green-500" />
          ) : (
            <ShieldOff className="h-5 w-5 text-muted-foreground" />
          )}
          <div>
            <Label className="text-base">Two-Factor Authentication</Label>
            <p className="text-sm text-muted-foreground">
              {isEnabled 
                ? 'Your account is protected with 2FA' 
                : 'Add an extra layer of security'}
            </p>
          </div>
        </div>
        <Button
          variant={isEnabled ? 'destructive' : 'default'}
          onClick={isEnabled ? () => setShowDisableDialog(true) : handleEnable2FA}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isEnabled ? (
            'Disable'
          ) : (
            'Enable'
          )}
        </Button>
      </div>

      {/* Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={handleCloseSetup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {step === 'qr' && 'Scan QR Code'}
              {step === 'verify' && 'Verify Code'}
              {step === 'backup' && 'Backup Codes'}
            </DialogTitle>
            <DialogDescription>
              {step === 'qr' && 'Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)'}
              {step === 'verify' && 'Enter the 6-digit code from your authenticator app'}
              {step === 'backup' && 'Save these backup codes in a safe place. Each code can only be used once.'}
            </DialogDescription>
          </DialogHeader>

          {step === 'qr' && (
            <div className="space-y-4">
              <div className="flex justify-center">
                {qrCodeUrl && (
                  <img src={qrCodeUrl} alt="2FA QR Code" className="rounded-lg border" />
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Can't scan? Enter this code manually:
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">
                    {secret}
                  </code>
                  <Button variant="outline" size="icon" onClick={copySecret}>
                    {copiedSecret ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <Button className="w-full" onClick={() => setStep('verify')}>
                Continue
              </Button>
            </div>
          )}

          {step === 'verify' && (
            <div className="space-y-4">
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
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('qr')} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={handleVerifyAndEnable}
                  disabled={loading || verificationCode.length !== 6}
                  className="flex-1"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & Enable'}
                </Button>
              </div>
            </div>
          )}

          {step === 'backup' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, index) => (
                  <code
                    key={index}
                    className="p-2 bg-muted rounded text-center font-mono text-sm"
                  >
                    {code}
                  </code>
                ))}
              </div>
              <Button variant="outline" className="w-full" onClick={copyBackupCodes}>
                <Copy className="h-4 w-4 mr-2" />
                Copy All Codes
              </Button>
              <p className="text-sm text-destructive text-center">
                ⚠️ These codes won't be shown again!
              </p>
              <Button className="w-full" onClick={handleCloseSetup}>
                I've Saved My Codes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldOff className="h-5 w-5 text-destructive" />
              Disable Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              Enter your 2FA code or a backup code to disable two-factor authentication.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDisableDialog(false);
                  setVerificationCode('');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisable2FA}
                disabled={loading || verificationCode.length !== 6}
                className="flex-1"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disable 2FA'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
