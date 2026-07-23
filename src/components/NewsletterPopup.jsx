import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../AuthContext';
import { API_BASE } from '../services/productService';

export default function NewsletterPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { currentUser } = useAuth();

  useEffect(() => {
    // Check if dismissed in local storage
    const hasDismissed = localStorage.getItem('fezyslimes_popup_dismissed');
    
    // Show if not dismissed and not signed in, wait a bit so it's not instantly aggressive
    if (!hasDismissed && !currentUser) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentUser]);

  const closePopup = () => {
    setIsOpen(false);
    localStorage.setItem('fezyslimes_popup_dismissed', 'true');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      if (!response.ok) throw new Error('Failed to subscribe');
      
      toast.success('Thanks for subscribing! 🤍');
      closePopup();
    } catch (error) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closePopup}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-[800px] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row"
          >
            {/* Close Button */}
            <button 
              onClick={closePopup}
              className="absolute top-4 right-4 z-10 p-2 bg-white/50 hover:bg-white/90 backdrop-blur-md rounded-full text-slate-500 hover:text-slate-800 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Image + Logo Side */}
            <div className="w-full md:w-1/2 bg-slate-100 relative flex flex-col">
              {/* Logo bar */}
              <div className="flex items-center justify-center py-5 px-4 bg-white/80 backdrop-blur-sm border-b border-slate-100">
                <img
                  src="/logo.png"
                  alt="FezySlimes Logo"
                  className="h-16 w-auto object-contain drop-shadow-sm"
                />
              </div>
              {/* Banner image */}
              <div className="flex-1 min-h-[180px]">
                <img 
                  src="/src/assets/popup-banner.jpg" 
                  alt="Fezy Slimes" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback if image not uploaded yet
                    e.target.src = 'https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?auto=format&fit=crop&w=800&q=80';
                  }}
                />
              </div>
            </div>

            {/* Content Side */}
            <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-gradient-to-br from-teal-50/50 via-white to-pink-50/50">
              <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-4 leading-tight">
                Welcome to fezy slimes.
              </h2>
              <p className="text-slate-600 font-medium mb-4">
                We only ship to
                Lagos, Ogun State, Oyo State, Abuja and Port Harcourt only.
              </p>
              <p className="text-slate-500 text-sm mb-8 font-medium">
                To get updates of fezy slimes daily put in your email (sign up)
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="email" 
                    placeholder="Enter your email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all font-semibold"
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full py-3.5 bg-cyan-400 hover:bg-cyan-500 disabled:bg-slate-300 text-white font-black rounded-2xl shadow-lg shadow-cyan-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {isLoading ? 'Subscribing...' : <><span className="flex items-center gap-2">Sign Up <ArrowRight className="w-5 h-5" /></span></>}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
