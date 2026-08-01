import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../AuthContext';
import { Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE } from '../services/productService';

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signup, loginWithGoogle, logout } = useAuth();
  
  const from = location.state?.from?.pathname || '/';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      toast.error('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    try {
      // Create user in Firebase Auth
      const userCredential = await signup(email, password, fullName);
      const user = userCredential.user;
      const token = await user.getIdToken();

      // Send signup OTP to verify email
      const response = await fetch(`${API_BASE}/api/otp/send-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase() })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send verification code.');

      // Also create initial profile
      await fetch(`${API_BASE}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          displayName: fullName,
          isVerified: false,
          createdAt: new Date().toISOString()
        })
      });

      toast.success('Account created! Please verify your email.');
      await logout(); // force logout until verified
      navigate('/verify-email', { state: { email: email.toLowerCase(), uid: user.uid, from } });
      
    } catch (err) {
      console.error(err);
      toast.error(err.message.replace('Firebase: ', ''));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      const userCredential = await loginWithGoogle();
      const user = userCredential.user;
      const token = await user.getIdToken();
      
      // Backend automatically creates the user document safely via Admin SDK
      await fetch(`${API_BASE}/api/auth/google-login`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Account created successfully with Google! ✨');
      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      toast.error('Google sign-up failed.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative px-6 py-12 sm:py-24 bg-gradient-to-br from-teal-50 via-white to-pink-50 overflow-y-auto">
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

        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">Create Account ✨</h1>
          <p className="text-slate-500 font-medium text-sm">Join the FezySlimes family today</p>
        </div>

        <form onSubmit={handleSignup} className="w-full space-y-4 mb-8">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Full Name" 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all font-semibold"
              required
            />
          </div>

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
              placeholder="Password (min. 6 characters)" 
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

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full py-4 bg-cyan-400 hover:bg-cyan-500 disabled:bg-slate-300 text-white font-black rounded-2xl shadow-lg shadow-cyan-200 transition-all active:scale-95 flex items-center justify-center gap-2 mt-2"
          >
            {isLoading ? 'Creating...' : <><span className="flex items-center gap-2">Sign Up <ArrowRight className="w-5 h-5" /></span></>}
          </button>
        </form>

        <div className="relative mb-8 text-center w-full">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-100"></div>
          </div>
          <span className="relative bg-white px-4 text-xs text-slate-400 font-bold uppercase tracking-wider">
            Or Join With
          </span>
        </div>

        <button 
          onClick={handleGoogleSignup}
          className="w-full py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-2xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-3 text-sm mb-6"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google
        </button>

        <p className="text-sm text-slate-500 font-medium">
          Already have an account? <Link to="/login" className="text-cyan-600 font-bold hover:text-pink-500 transition-colors">Log In here</Link>
        </p>

      </motion.div>
    </div>
  );
}
