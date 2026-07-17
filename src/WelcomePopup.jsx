import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, UserPlus, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function WelcomePopup() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we've shown this popup before
    const hasSeenPopup = localStorage.getItem('fezyslimes_welcome_seen');
    if (!hasSeenPopup) {
      // Delay slightly for premium effect
      const timer = setTimeout(() => setIsOpen(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  // Prevent scrolling while welcome popup is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem('fezyslimes_welcome_seen', 'true');
  };

  const handleAction = (route) => {
    handleClose();
    navigate(route);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Blur Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={handleClose} 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl" 
          />

          {/* Premium Modal Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 30 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 30 }} 
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="relative bg-white/95 border border-white rounded-[2rem] w-full max-w-md shadow-2xl shadow-pink-200/40 flex flex-col z-10 overflow-hidden"
          >
            {/* Soft pink/turquoise glow background */}
            <div className="absolute inset-0 bg-gradient-to-br from-teal-50/50 via-transparent to-pink-50/50 pointer-events-none" />

            {/* Close Button */}
            <button 
              onClick={handleClose}
              className="absolute top-5 right-5 z-20 p-2 text-slate-400 hover:text-pink-500 hover:bg-slate-50 rounded-full transition-all border border-transparent hover:border-pink-100 shadow-sm"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8 relative z-10 flex flex-col items-center">
              {/* Large Logo */}
              <img src="/logo.png" alt="FezySlimes Logo" className="h-28 w-auto mb-6 drop-shadow-md hover:scale-105 transition-transform duration-300" />
              
              {/* Title & Subtitle */}
              <h2 className="text-2xl font-black text-slate-800 text-center mb-1">
                Welcome to FezySlimes <span className="inline-block align-middle leading-none select-none text-xl mx-0.5">🤍</span>
              </h2>
              <p className="text-cyan-600 font-extrabold text-sm mb-4 text-center tracking-wide">
                Nigeria's First Premium Slime Brand
              </p>

              {/* Description */}
              <p className="text-slate-500 text-sm text-center mb-8 leading-relaxed font-medium">
                Sign in or create an account to enjoy faster checkout, order tracking, saved favourites, and exclusive slime releases.
              </p>

              {/* Action Buttons */}
              <div className="w-full flex flex-col gap-3">
                <button 
                  onClick={() => handleAction('/login')}
                  className="w-full py-4 bg-cyan-400 hover:bg-cyan-500 text-white font-black rounded-2xl shadow-lg shadow-cyan-150 transition-all active:scale-95 flex justify-center items-center gap-2 text-base"
                >
                  <LogIn className="w-5 h-5" /> Log In
                </button>
                
                <button 
                  onClick={() => handleAction('/signup')}
                  className="w-full py-4 bg-pink-400 hover:bg-pink-500 text-white font-black rounded-2xl shadow-lg shadow-pink-150 transition-all active:scale-95 flex justify-center items-center gap-2 text-base"
                >
                  <UserPlus className="w-5 h-5" /> Create Account
                </button>
              </div>

              {/* Continue as Guest */}
              <div className="mt-8 text-center">
                <button 
                  onClick={handleClose}
                  className="text-xs text-slate-400 hover:text-cyan-500 font-extrabold uppercase tracking-widest transition-colors flex items-center gap-1.5"
                >
                  Continue as Guest <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
