import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, Mail, Lock, User, Loader2, AlertCircle, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';

// Password requirements checker
const PasswordRequirements = ({ password }) => {
  const requirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter (a-z)', met: /[a-z]/.test(password) },
    { label: 'One number (0-9)', met: /[0-9]/.test(password) },
    { label: 'One special character (!@#$%^&*)', met: /[^a-zA-Z0-9]/.test(password) },
  ];

  if (!password) return null;

  return (
    <div className="mt-2 p-3 bg-zinc-50 rounded-lg border text-sm space-y-1">
      <p className="font-medium text-zinc-700 mb-2">Password requirements:</p>
      {requirements.map((req, idx) => (
        <div key={idx} className={`flex items-center gap-2 ${req.met ? 'text-green-600' : 'text-zinc-400'}`}>
          {req.met ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : (
            <XCircle className="w-3.5 h-3.5" />
          )}
          <span>{req.label}</span>
        </div>
      ))}
    </div>
  );
};

export function AuthView({ onShowVerify }) {
  const { signIn, signInSSO, signUp, loading, error, clearError } = useAuth();
  const [tab, setTab] = useState('login');
  
  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirm, setRegisterConfirm] = useState('');
  const [localError, setLocalError] = useState('');
  
  // Password visibility toggles
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Show password requirements
  const [showPasswordReqs, setShowPasswordReqs] = useState(false);

  // Password validation helper
  const isPasswordValid = (password) => {
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[^a-zA-Z0-9]/.test(password)
    );
  };

  // Email validation helper
  const isWsuEmail = (email) => {
    return email.toLowerCase().endsWith('@wayne.edu');
  };

  // Format error message for display
  const formatErrorMessage = (errorMsg) => {
    if (!errorMsg) return '';
    
    // Convert technical messages to user-friendly ones
    const errorMappings = {
      'Password must contain at least one uppercase letter': 'Please include at least one capital letter (A-Z)',
      'Password must contain at least one lowercase letter': 'Please include at least one lowercase letter (a-z)',
      'Password must contain at least one number': 'Please include at least one number (0-9)',
      'Password must contain at least one special character': 'Please include at least one special character (!@#$%^&*)',
      'Password must be at least 8 characters': 'Password needs to be at least 8 characters long',
      'Must use a @wayne.edu email address': 'Please use your Wayne State email (@wayne.edu)',
      'Email already registered': 'This email is already registered. Try logging in instead.',
      'Invalid email or password': 'The email or password you entered is incorrect',
      'Invalid credentials': 'The email or password you entered is incorrect',
    };

    // Check if the error contains any of the mapped messages
    for (const [key, value] of Object.entries(errorMappings)) {
      if (errorMsg.includes(key)) {
        return value;
      }
    }

    return errorMsg;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLocalError('');
    clearError();
    
    if (!loginEmail || !loginPassword) {
      setLocalError('Please fill in all fields');
      return;
    }
    
    await signIn(loginEmail, loginPassword);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLocalError('');
    clearError();
    
    if (!registerName || !registerEmail || !registerPassword) {
      setLocalError('Please fill in all fields');
      return;
    }

    if (!isWsuEmail(registerEmail)) {
      setLocalError('Please use your Wayne State email address (@wayne.edu)');
      return;
    }
    
    if (registerPassword !== registerConfirm) {
      setLocalError('Passwords do not match');
      return;
    }
    
    if (!isPasswordValid(registerPassword)) {
      setLocalError('Please make sure your password meets all requirements');
      return;
    }

    const result = await signUp({
      name: registerName,
      email: registerEmail,
      password: registerPassword,
    });

    if (result.success && onShowVerify) {
      onShowVerify();
    }
  };

  const handleSSO = async () => {
    setLocalError('');
    clearError();
    await signInSSO();
  };

  const displayError = formatErrorMessage(localError || error);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-xl border-2">
        <CardHeader className="text-center space-y-2 pb-2">
          <div className="mx-auto w-16 h-16 bg-[var(--wsu-green)] rounded-2xl flex items-center justify-center mb-2">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">WSU Forum</CardTitle>
          <CardDescription>
            Connect with the Wayne State community
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* SSO Button */}
          <Button
            onClick={handleSSO}
            disabled={loading}
            className="w-full h-12 bg-[var(--wsu-green)] hover:bg-[var(--wsu-green)]/90 text-white font-medium"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Shield className="w-4 h-4 mr-2" />
            )}
            Continue with Wayne State SSO
          </Button>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-xs text-zinc-500">
              or continue with email
            </span>
          </div>

          {/* Error Display */}
          {displayError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          {/* Tabs */}
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="register">Sign Up</TabsTrigger>
            </TabsList>

            {/* Login Form */}
            <TabsContent value="login" className="space-y-4 mt-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <Input
                      type="email"
                      placeholder="your.email@wayne.edu"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="pl-10"
                      disabled={loading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <Input
                      type={showLoginPassword ? "text" : "password"}
                      placeholder="Password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="pl-10 pr-10"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      {showLoginPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full"
                  variant="outline"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Sign In
                </Button>
              </form>
              <button
                type="button"
                className="w-full text-sm text-[var(--wsu-green)] hover:underline"
                onClick={() => {/* TODO: Forgot password */}}
              >
                Forgot your password?
              </button>
            </TabsContent>

            {/* Register Form */}
            <TabsContent value="register" className="space-y-4 mt-4">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    type="text"
                    placeholder="Full name"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <Input
                      type="email"
                      placeholder="your.accessid@wayne.edu"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      className="pl-10"
                      disabled={loading}
                    />
                  </div>
                  <p className="text-xs text-zinc-500 pl-1">
                    <span className="font-medium">Note:</span> Must be a valid @wayne.edu email
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <Input
                      type={showRegisterPassword ? "text" : "password"}
                      placeholder="Create password"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      onFocus={() => setShowPasswordReqs(true)}
                      className="pl-10 pr-10"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      {showRegisterPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {showPasswordReqs && (
                    <PasswordRequirements password={registerPassword} />
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    value={registerConfirm}
                    onChange={(e) => setRegisterConfirm(e.target.value)}
                    className="pl-10 pr-10"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {registerConfirm && registerPassword !== registerConfirm && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    Passwords do not match
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={loading || !isPasswordValid(registerPassword) || registerPassword !== registerConfirm}
                  className="w-full bg-[var(--wsu-green)] hover:bg-[var(--wsu-green)]/90 text-white"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Create Account
                </Button>
              </form>
              <p className="text-xs text-center text-zinc-500">
                By signing up, you agree to our Terms of Service and Privacy Policy
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default AuthView;
