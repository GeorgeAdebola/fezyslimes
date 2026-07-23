import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowLeft, ArrowRight, RefreshCw, CheckCircle2, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE } from '../services/productService';


export default function ConfirmOrder() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const reference = searchParams.get('ref') || '';
  const email = searchParams.get('email') || '';

  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [isConfirmed, setIsConfirmed] = useState(false);

  useEffect(() => {
    if (!reference || !email) {
      toast.error('Invalid confirmation link. Please check your email.');
      navigate('/');
    }
  }, [reference, email, navigate]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (code.length !== 6 || isNaN(code)) {
      toast.error('Please enter a valid 6-digit OTP code.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/otp/confirm-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, reference, code })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Confirmation failed.');
      }

      setIsConfirmed(true);
      toast.success('Order confirmed! A receipt has been sent to your email 💖');
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setIsResending(true);
    try {
      const response = await fetch(`${API_BASE}/api/otp/send-order-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, reference })
      });

      if (!response.ok) {
        throw new Error('Could not resend OTP.');
      }

      toast.success('A new confirmation code has been sent! ✉️');
      setCooldown(60);
    } catch (err) {
      toast.error(err.message || 'Error resending OTP.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative px-6 py-24 bg-gradient-to-br from-teal-50 via-white to-pink-50 overflow-hidden font-sans">
      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-200/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-pink-200/20 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md bg-white/80 backdrop-blur-xl border border-white/60 p-8 rounded-[2rem] shadow-xl shadow-pink-100/30 z-10 flex flex-col items-center"
      >
        {!isConfirmed ? (
          <>
            <Link to="/track-order" className="self-start text-xs font-bold text-slate-400 hover:text-cyan-500 transition-colors flex items-center gap-1.5 mb-6">
              <ArrowLeft className="w-4 h-4" /> Back to Tracking
            </Link>

            {/* Icon */}
            <div className="w-20 h-20 rounded-[1.5rem] bg-pink-50 border border-pink-100 flex items-center justify-center text-pink-500 shadow-md shadow-pink-100/40 mb-6">
              <Package className="w-10 h-10" />
            </div>

            <div className="text-center mb-8">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Confirm Your Order 📦</h1>
              <p className="text-slate-500 font-medium text-sm leading-relaxed">
                A 6-digit confirmation code was sent to <span className="font-bold text-slate-700">{email}</span>. Enter it below to finalize your order.
              </p>
            </div>

            <form onSubmit={handleConfirm} className="w-full space-y-6">
              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Enter 6-digit Code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 text-center text-2xl tracking-[0.75rem] font-bold text-slate-800 placeholder-slate-300 focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition-all"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || code.length !== 6}
                className="w-full py-4 bg-pink-400 hover:bg-pink-500 disabled:bg-slate-300 text-white font-black rounded-2xl shadow-lg shadow-pink-200 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {isLoading ? 'Confirming...' : <span className="flex items-center gap-2">Confirm Order <ArrowRight className="w-5 h-5" /></span>}
              </button>
            </form>

            <div className="mt-8 text-center">
              <button
                onClick={handleResend}
                disabled={cooldown > 0 || isResending}
                className={`text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 mx-auto ${cooldown > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-cyan-500 hover:text-cyan-600'}`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                {cooldown > 0 ? `Resend Code (${cooldown}s)` : 'Resend Confirmation Code'}
              </button>
            </div>

            <p className="mt-6 text-[11px] text-slate-400 font-medium text-center">
              Your order is already recorded and paid. Confirming helps us process and package your slime faster!
            </p>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center text-center space-y-6 py-6"
          >
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-100 to-cyan-100 border-4 border-white shadow-xl flex items-center justify-center text-green-500">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 mb-2">Order Confirmed! 💖</h2>
              <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-xs">
                Your order has been confirmed and is now being processed. A receipt has been sent to your email.
              </p>
            </div>
            <div className="flex flex-col gap-3 w-full pt-4">
              <button
                onClick={() => navigate(`/track-order`)}
                className="w-full py-3.5 bg-cyan-400 hover:bg-cyan-500 text-white font-black rounded-2xl shadow-lg shadow-cyan-200 transition-all active:scale-95"
              >
                Track My Order
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full py-3.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold rounded-2xl transition-all"
              >
                Continue Shopping
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
