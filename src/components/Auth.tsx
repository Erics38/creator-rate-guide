/**
 * Authentication Component
 *
 * Provides login, signup, and email confirmation UI
 * Uses shadcn/ui components for consistent styling
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { LogIn, UserPlus, Mail, Eye, EyeOff, KeyRound } from 'lucide-react';

export const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showVerifyTab, setShowVerifyTab] = useState(false);

  const { login, signup, confirmSignup, resendConfirmationCode, forgotPassword, resetPasswordWithCode, loading } = useAuth();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      toast({
        title: 'Login Successful',
        description: 'Welcome back!',
      });
    } catch (error: any) {
      toast({
        title: 'Login Failed',
        description: error.message || 'Invalid email or password',
        variant: 'destructive',
      });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { isSignUpComplete, nextStep } = await signup(email, password);

      if (!isSignUpComplete) {
        setPendingEmail(email);
        setShowConfirmation(true);
        toast({
          title: 'Verification Required',
          description: 'Please check your email for a verification code.',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Signup Failed',
        description: error.message || 'Failed to create account',
        variant: 'destructive',
      });
    }
  };

  const handleConfirmSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    // Use pendingEmail first (from signup), fallback to email field (from verify tab)
    const emailToVerify = pendingEmail || email;

    if (!emailToVerify) {
      toast({
        title: 'Email Required',
        description: 'Please enter your email address',
        variant: 'destructive',
      });
      return;
    }

    try {
      await confirmSignup(emailToVerify, confirmationCode);
      toast({
        title: 'Account Verified',
        description: 'Your account has been verified. You are now logged in!',
      });
      setShowConfirmation(false);
      setConfirmationCode('');
      setEmail('');
      setPendingEmail('');
    } catch (error: any) {
      console.error('Verification error:', error);
      toast({
        title: 'Verification Failed',
        description: error.message || 'Invalid verification code',
        variant: 'destructive',
      });
    }
  };

  const handleResendCode = async () => {
    // Use pendingEmail first (from signup), fallback to email field (from verify tab)
    const emailToResend = pendingEmail || email;

    if (!emailToResend) {
      toast({
        title: 'Email Required',
        description: 'Please enter your email address first',
        variant: 'destructive',
      });
      return;
    }

    try {
      await resendConfirmationCode(emailToResend);
      toast({
        title: 'Code Sent',
        description: `A new verification code has been sent to ${emailToResend}`,
      });
    } catch (error: any) {
      console.error('Resend code error:', error);
      toast({
        title: 'Failed to Resend',
        description: error.message || 'Failed to resend verification code',
        variant: 'destructive',
      });
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await forgotPassword(email);
      setPendingEmail(email);
      setShowPasswordReset(true);
      toast({
        title: 'Reset Code Sent',
        description: `A password reset code has been sent to ${email}`,
      });
    } catch (error: any) {
      toast({
        title: 'Failed to Send Reset Code',
        description: error.message || 'Failed to initiate password reset',
        variant: 'destructive',
      });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await resetPasswordWithCode(pendingEmail, confirmationCode, newPassword);
      toast({
        title: 'Password Reset Successful',
        description: 'You can now log in with your new password',
      });
      setShowPasswordReset(false);
      setConfirmationCode('');
      setNewPassword('');
      setPendingEmail('');
    } catch (error: any) {
      toast({
        title: 'Reset Failed',
        description: error.message || 'Failed to reset password',
        variant: 'destructive',
      });
    }
  };

  if (showPasswordReset) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-subtle p-6">
        <Card className="w-full max-w-md shadow-medium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Reset Password
            </CardTitle>
            <CardDescription>
              We sent a reset code to <strong>{pendingEmail}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-code" className="text-base font-semibold">Reset Code</Label>
                <Input
                  id="reset-code"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={confirmationCode}
                  onChange={(e) => setConfirmationCode(e.target.value)}
                  required
                  maxLength={6}
                  className="text-center text-lg tracking-widest font-mono"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Check your email for the 6-digit reset code
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Minimum 8 characters, including uppercase, lowercase, and numbers
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading || confirmationCode.length !== 6 || newPassword.length < 8}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setShowPasswordReset(false);
                  setConfirmationCode('');
                  setNewPassword('');
                }}
              >
                Back to Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showConfirmation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-subtle p-6">
        <Card className="w-full max-w-md shadow-medium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Verify Your Email
            </CardTitle>
            <CardDescription>
              We sent a verification code to <strong>{pendingEmail}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleConfirmSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-base font-semibold">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={confirmationCode}
                  onChange={(e) => setConfirmationCode(e.target.value)}
                  required
                  maxLength={6}
                  className="text-center text-lg tracking-widest font-mono"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Check your email for the 6-digit verification code
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading || confirmationCode.length !== 6}>
                {loading ? 'Verifying...' : 'Verify Email'}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleResendCode}
                disabled={loading}
              >
                Resend Code
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setShowConfirmation(false);
                  setConfirmationCode('');
                }}
              >
                Back to Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-subtle p-6">
      <Card className="w-full max-w-md shadow-medium">
        <CardHeader>
          <CardTitle>RateQ</CardTitle>
          <CardDescription>
            Sign in to save and track your collaboration calculations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="login" className="flex items-center gap-1 text-xs">
                <LogIn className="h-3 w-3" />
                Login
              </TabsTrigger>
              <TabsTrigger value="signup" className="flex items-center gap-1 text-xs">
                <UserPlus className="h-3 w-3" />
                Sign Up
              </TabsTrigger>
              <TabsTrigger value="reset" className="flex items-center gap-1 text-xs">
                <KeyRound className="h-3 w-3" />
                Reset
              </TabsTrigger>
              <TabsTrigger value="verify" className="flex items-center gap-1 text-xs">
                <Mail className="h-3 w-3" />
                Verify
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Logging in...' : 'Login'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Minimum 8 characters, including uppercase, lowercase, and numbers
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creating account...' : 'Sign Up'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="reset">
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter your email address to receive a password reset code
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Sending...' : 'Send Reset Code'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="verify">
              <form onSubmit={handleConfirmSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="verify-email">Email</Label>
                  <Input
                    id="verify-email"
                    type="email"
                    placeholder="your@email.com"
                    value={pendingEmail || email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setPendingEmail(e.target.value);
                    }}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="verify-code" className="text-base font-semibold">Verification Code</Label>
                  <Input
                    id="verify-code"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={confirmationCode}
                    onChange={(e) => setConfirmationCode(e.target.value)}
                    required
                    maxLength={6}
                    className="text-center text-lg tracking-widest font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Check your email for the 6-digit verification code
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={loading || confirmationCode.length !== 6}>
                  {loading ? 'Verifying...' : 'Verify Account'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleResendCode}
                  disabled={loading}
                >
                  Resend Code
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
