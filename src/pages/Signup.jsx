import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../AuthContext';
import { Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE } from '../services/productService';

import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signup, loginWithCustomToken, loginWithGoogle, logout } = useAuth();
  
  // Tabs: 'otp' | 'password'
  const [loginMethod, setLoginMethod] = useState('otp');
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // OTP flow state
  const [otpSent, setOtpSent] = useState(false);

  // Determine redirect page (from location state or default to /)
  const from = location.state?.from?.pathname || '/';

  // Strong Password Checklist
  const hasMinLength = password.length >= 6;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber;

  const handlePasswordSignup = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all required fields.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    if (!isPasswordValid) {
      toast.error('Please meet all password security requirements.');
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await signup(email, password);
      const user = userCredential.user;
      
      await setDoc(doc(db, 'users', user.uid), {
        email: email.toLowerCase(),
        isVerified: false,
        createdAt: new Date()
      });

      await fetch(`${API_BASE}/api/otp/send-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase() })
      });
      
      toast.success('Account created! Please verify your email with the OTP sent to you 🤍');
      await logout();
      navigate('/verify-email', { state: { email: email.toLowerCase(), uid: user.uid } });
    } catch (err) {
      console.error(err);
      toast.error(err.message.replace('Firebase: ', ''));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOTP = async (e) => {
    if (e) e.preventDefault();
    if (!email) {
      toast.error('Please enter your email.');
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/otp/send-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase() })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send OTP');
      
      setOtpSent(true);
      toast.success('Verification code sent to your email! 🤍');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otp || otp.length < 6) {
      toast.error('Please enter the 6-digit code.');
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/otp/verify-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase(), code: otp })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Invalid OTP');
      
      const userCredential = await loginWithCustomToken(data.customToken);
      const user = userCredential.user;
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          email: email.toLowerCase(),
          isVerified: true,
          createdAt: new Date()
        });
      }

      toast.success('Account created seamlessly! ✨');
      navigate(from, { replace: true });
      
    } catch (err) {
      console.error(err);
      toast.error(err.message.replace('Firebase: ', ''));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const userCredential = await loginWithGoogle();
      const user = userCredential.user;
      
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          email: user.email.toLowerCase(),
          isVerified: true,
          createdAt: new Date()
        });
      }
      
      toast.success('Logged in successfully with Google! ✨');
      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      toast.error('Google sign-in failed.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative px-6 py-24 bg-gradient-to-br from-teal-50 via-white to-pink-50 overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-200/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-pink-200/20 blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md bg-white/80 backdrop-blur-xl border border-white/60 p-8 rounded-[2rem] shadow-xl shadow-pink-100/30 z-10 flex flex-col items-center"
      >
        <Link to="/" className="mb-6">
          <img src="/logo.png" alt="FezySlimes Logo" className="h-24 w-auto drop-shadow-md hover:scale-105 transition-transform" />
        </Link>

        <div className="text-center mb-6">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">Create Account 🤍</h1>
          <p className="text-slate-500 font-medium text-sm">Join Nigeria's Premium Slime Community</p>
        </div>

        <div className="flex w-full bg-slate-100 rounded-xl p-1 mb-6">
          <button 
            type="button"
            onClick={() => setLoginMethod('otp')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${loginMethod === 'otp' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Email Code
          </button>
          <button 
            type="button"
            onClick={() => setLoginMethod('password')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${loginMethod === 'password' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Password
          </button>
        </div>

        <AnimatePresence mode="wait">
          {loginMethod === 'otp' ? (
            <motion.form 
              key="otp-form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              onSubmit={otpSent ? handleVerifyOTP : handleSendOTP} 
              className="w-full space-y-4"
            >
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="email" 
                  placeholder="Email Address" 
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (otpSent) setOtpSent(false);
                  }}
                  disabled={otpSent || isLoading}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all font-semibold disabled:opacity-60"
                  required
                />
              </div>

              {otpSent && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="relative"
                >
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Enter 6-digit code" 
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all font-semibold text-center tracking-widest text-lg"
                    required
                  />
                  <div className="flex justify-end pt-2">
                    <button type="button" onClick={handleSendOTP} disabled={isLoading} className="text-xs font-bold text-cyan-600 hover:text-pink-500 transition-colors">
                      Resend Code
                    </button>
                  </div>
                </motion.div>
              )}

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full py-4 bg-cyan-400 hover:bg-cyan-500 disabled:bg-slate-300 text-white font-black rounded-2xl shadow-lg shadow-cyan-200 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {isLoading ? (otpSent ? 'Verifying...' : 'Sending...') : (
                  <><span className="flex items-center gap-2">{otpSent ? 'Verify & Create Account' : 'Send Verification Code'} <ArrowRight className="w-5 h-5" /></span></>
                )}
              </button>
            </motion.form>
          ) : (
            <motion.form 
              key="password-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              onSubmit={handlePasswordSignup} 
              className="w-full space-y-4"
            >
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="email" 
                  placeholder="Email Address" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all font-semibold"
                  required
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-12 py-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all font-semibold"
                  required
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-cyan-500 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="password" 
                  placeholder="Confirm Password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all font-semibold"
                  required
                />
              </div>

              {password.length > 0 && (
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs space-y-2 font-medium text-slate-500">
                  <p className="font-bold text-slate-600 mb-1">Password Requirements:</p>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className={`w-4 h-4 ${hasMinLength ? 'text-green-500' : 'text-slate-300'}`} />
                    <span>At least 6 characters</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className={`w-4 h-4 ${hasUppercase ? 'text-green-500' : 'text-slate-300'}`} />
                    <span>At least 1 uppercase letter (A-Z)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className={`w-4 h-4 ${hasNumber ? 'text-green-500' : 'text-slate-300'}`} />
                    <span>At least 1 number (0-9)</span>
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                disabled={isLoading || (password.length > 0 && !isPasswordValid)}
                className="w-full py-4 bg-pink-400 hover:bg-pink-500 disabled:bg-slate-300 text-white font-black rounded-2xl shadow-lg shadow-pink-200 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {isLoading ? 'Creating Account...' : <><span className="flex items-center gap-2">Sign Up <ArrowRight className="w-5 h-5" /></span></>}
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="relative my-8 text-center w-full">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-100"></div>
          </div>
          <span className="relative bg-white px-4 text-xs text-slate-400 font-bold uppercase tracking-wider">
            Or Sign Up With
          </span>
        </div>

        <button 
          onClick={handleGoogleLogin}
          className="w-full py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-2xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-3 text-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google
        </button>

        <p className="mt-8 text-center text-sm text-slate-500 font-medium">
          Already have an account?{' '}
          <Link to="/login" className="text-pink-500 hover:text-pink-600 font-bold underline underline-offset-2">
            Log In
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
