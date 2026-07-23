import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE } from '../services/productService';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (location.state?.email) {
      setEmail(location.state.email);
    } else {
      // If direct navigation, redirect to login
      toast.error('Session expired or direct access denied.');
      navigate('/login');
    }
  }, [location, navigate]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (code.length !== 6 || isNaN(code)) {
      toast.error('Please enter a valid 6-digit OTP code.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/otp/verify-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Verification failed.');
      }

      toast.success('Email verified successfully! You can now log in 🥳');
      navigate('/login', { replace: true });
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;

    try {
      const response = await fetch(`${API_BASE}/api/otp/send-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        throw new Error('Could not resend OTP.');
      }

      toast.success('A new 6-digit OTP has been sent to your email! ✉️');
      setCooldown(60);
    } catch (err) {
      toast.error(err.message || 'Error resending OTP.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative px-6 py-24 bg-gradient-to-br from-teal-50 via-white to-pink-50 overflow-hidden font-sans">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-200/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-pink-200/20 blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md bg-white/80 backdrop-blur-xl border border-white/60 p-8 rounded-[2rem] shadow-xl shadow-pink-100/30 z-10 flex flex-col items-center"
      >
        <Link to="/login" className="self-start text-xs font-bold text-slate-400 hover:text-cyan-500 transition-colors flex items-center gap-1.5 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Log In
        </Link>

        {/* Shield verification icon */}
        <div className="w-20 h-20 rounded-[1.5rem] bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-500 shadow-md shadow-cyan-100/40 mb-6">
          <ShieldCheck className="w-10 h-10" />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Verify Your Email ✉️</h1>
          <p className="text-slate-500 font-medium text-sm leading-relaxed">
            We sent a 6-digit verification code to <span className="font-bold text-slate-700">{email}</span>. Please enter it below to activate your account.
          </p>
        </div>

        <form onSubmit={handleVerify} className="w-full space-y-6">
          <div className="relative">
            <input 
              type="text" 
              maxLength={6}
              placeholder="Enter 6-digit OTP" 
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 text-center text-2xl tracking-[0.75rem] font-bold text-slate-800 placeholder-slate-300 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading || code.length !== 6}
            className="w-full py-4 bg-cyan-400 hover:bg-cyan-500 disabled:bg-slate-300 text-white font-black rounded-2xl shadow-lg shadow-cyan-200 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            {isLoading ? 'Verifying...' : <span className="flex items-center gap-2">Verify Account <ArrowRight className="w-5 h-5" /></span>}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={handleResend}
            disabled={cooldown > 0}
            className={`text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${cooldown > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-pink-500 hover:text-pink-600'}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cooldown > 0 ? 'animate-spin' : ''}`} />
            {cooldown > 0 ? `Resend OTP (${cooldown}s)` : 'Resend OTP Code'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
