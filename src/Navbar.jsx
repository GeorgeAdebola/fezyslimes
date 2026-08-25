import { useState, useEffect } from 'react';
import { ShoppingCart, Menu, X, Heart, Search, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function Navbar({ cartCount, onCartClick, activeSection, scrollToSection }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { id: 'home', label: 'Home' },
    { id: 'shop', label: 'Shop' },
    { id: 'about', label: 'About' },
    { id: 'care', label: 'Slime Care' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'contact', label: 'Contact' },
  ];

  const handleNavClick = (sectionId) => {
    setIsMobileMenuOpen(false);
    scrollToSection(sectionId);
  };

  const handleAccountClick = () => {
    navigate('/account');
  };

  const isHome = location.pathname === '/';

  return (
    <>
      {/* Top Scrolling Announcement Banner */}
      <div className="w-full bg-cyan-500 text-white overflow-hidden py-2 text-[10px] sm:text-xs font-black tracking-wider uppercase fixed top-0 left-0 right-0 z-50 shadow-sm flex items-center h-9">
        <div className="animate-marquee flex gap-8 whitespace-nowrap">
          <div className="flex shrink-0 items-center gap-8 pr-8">
            <span>✨ Shop open every Saturday 3pm</span>
            <span>🚀 Fast delivery</span>
            <span>💖 Slime activator is compulsory with every order — free when you buy 4 or more slimes!</span>
          </div>
          <div className="flex shrink-0 items-center gap-8 pr-8" aria-hidden="true">
            <span>✨ Shop open every Saturday 3pm</span>
            <span>🚀 Fast delivery</span>
            <span>💖 Slime activator is compulsory with every order — free when you buy 4 or more slimes!</span>
          </div>
        </div>
      </div>

      <nav
        className={`fixed top-9 left-0 w-full z-45 transition-all duration-500 ${
          isScrolled || !isHome
            ? 'bg-white/90 border-b border-slate-100 shadow-md shadow-pink-100/30 backdrop-blur-xl py-3'
            : 'bg-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Brand Logo */}
          <div 
            onClick={() => { navigate('/'); setTimeout(() => window.scrollTo(0,0), 100); }}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <img src="/logo.png" alt="FezySlimes" className="h-16 w-auto group-hover:scale-105 transition-transform drop-shadow-sm" />
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6 lg:gap-8">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => handleNavClick(link.id)}
                className={`text-sm font-bold tracking-wide transition-colors relative py-1 ${
                  isHome && activeSection === link.id
                    ? 'text-cyan-500'
                    : 'text-slate-600 hover:text-cyan-500'
                }`}
              >
                {link.label}
                {isHome && activeSection === link.id && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan-400 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Icons & Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button className="p-2.5 text-slate-400 hover:text-cyan-500 hover:bg-white/50 rounded-xl transition-all hidden sm:flex">
              <Search className="w-5 h-5" />
            </button>
            
            <button className="p-2.5 text-slate-400 hover:text-pink-500 hover:bg-white/50 rounded-xl transition-all hidden sm:flex">
              <Heart className="w-5 h-5" />
            </button>

            {currentUser ? (
              <button 
                onClick={handleAccountClick}
                className="px-4 py-2 text-slate-700 hover:text-cyan-600 hover:bg-cyan-50/50 rounded-xl font-extrabold transition-all flex items-center gap-2 text-sm border border-slate-100 hover:border-cyan-100"
              >
                <img 
                  src={currentUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${currentUser.email}`} 
                  alt="Avatar" 
                  className="w-6 h-6 rounded-full border border-pink-200"
                />
                <span className="hidden lg:inline max-w-[100px] truncate">
                  {currentUser.displayName || currentUser.email.split('@')[0]}
                </span>
              </button>
            ) : (
              <button 
                onClick={() => navigate('/login')}
                className="px-4 py-2 text-slate-600 hover:text-cyan-500 hover:bg-white/80 rounded-xl font-bold transition-all flex items-center gap-2 text-sm shadow-sm border border-transparent hover:border-slate-100"
              >
                <User className="w-4 h-4" />
                <span className="hidden lg:inline">Login</span>
              </button>
            )}

            {/* Shopping Cart Toggle */}
            <button
              onClick={onCartClick}
              aria-label={`Shopping Cart${cartCount > 0 ? ` (${cartCount} items)` : ''}`}
              className="p-2.5 bg-white hover:bg-cyan-50 border border-slate-100 text-slate-600 hover:text-cyan-500 shadow-sm rounded-xl transition-all relative flex items-center justify-center active:scale-95 hover:-translate-y-1"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-pink-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md shadow-pink-500/30 border-2 border-white pointer-events-none">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2.5 text-slate-400 hover:text-cyan-500 hover:bg-white/50 rounded-xl transition-all md:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer Slide-out Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex justify-end md:hidden">
          {/* Overlay */}
          <div
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          {/* Drawer Body */}
          <div className="relative w-80 max-w-full bg-white/95 backdrop-blur-xl border-l border-white p-6 flex flex-col h-full shadow-2xl justify-between">
            <div>
              <div className="flex items-center justify-between mb-8">
                <img src="/logo.png" alt="FezySlimes" className="h-8 w-auto" />
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-slate-400 hover:text-pink-500 hover:bg-pink-50 rounded-xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {navLinks.map((link) => (
                  <button
                    key={link.id}
                    onClick={() => handleNavClick(link.id)}
                    className={`text-left py-3 px-4 rounded-xl text-base font-bold transition-all ${
                      isHome && activeSection === link.id
                        ? 'bg-cyan-50 text-cyan-600 border-l-4 border-cyan-400 pl-3 shadow-sm'
                        : 'text-slate-600 hover:text-cyan-500 hover:bg-slate-50'
                    }`}
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <button 
                onClick={() => { setIsMobileMenuOpen(false); navigate(currentUser ? '/account' : '/login'); }}
                className="w-full py-3.5 bg-slate-50 border border-slate-100 hover:bg-cyan-50 text-slate-700 hover:text-cyan-600 font-bold rounded-xl flex justify-center items-center gap-2 transition-all shadow-sm"
              >
                <User className="w-5 h-5" /> {currentUser ? (currentUser.displayName || currentUser.email.split('@')[0]) : 'Login'}
              </button>
              <div className="border-t border-slate-100 pt-6 text-center text-xs text-slate-400 font-medium">
                &copy; FezySlimes. Premium Handmade Slimes.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
