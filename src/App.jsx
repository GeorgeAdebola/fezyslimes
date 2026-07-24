import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './AuthContext';
import Navbar from './Navbar';
import CartDrawer from './CartDrawer';
import ProductQuickView from './ProductQuickView';
import WelcomePopup from './WelcomePopup';
import NewsletterPopup from './components/NewsletterPopup';
import Home from './pages/Home';
import OrderTracking from './pages/OrderTracking';
import CustomerDashboard from './pages/CustomerDashboard';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import VerifyEmail from './pages/VerifyEmail';
import ConfirmOrder from './pages/ConfirmOrder';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/index';
import PrivacyPolicy from './pages/legal/PrivacyPolicy';
import TermsAndConditions from './pages/legal/TermsAndConditions';
import RefundPolicy from './pages/legal/RefundPolicy';
import FAQ from './pages/legal/FAQ';
import { reviews } from './data'; // reviews are static UI content, not Firestore data
import { getWishlist, updateWishlist } from './services/dbService';
import toast from 'react-hot-toast';

function Layout() {
  const { currentUser } = useAuth();
  const [activeSection, setActiveSection] = useState('home');
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const location = useLocation();

  // Load wishlist from database or localStorage fallback
  useEffect(() => {
    if (!currentUser) {
      const guestList = localStorage.getItem('fezyslimes_guest_wishlist');
      setFavorites(guestList ? JSON.parse(guestList) : []);
      return;
    }
    const loadWishlist = async () => {
      try {
        const list = await getWishlist(currentUser.uid);
        setFavorites(list);
      } catch (err) {
        console.error("Error loading wishlist: ", err);
      }
    };
    loadWishlist();
  }, [currentUser]);

  useEffect(() => {
    if (location.pathname !== '/') return;
    
    const handleScrollSpy = () => {
      const sections = ['home', 'shop', 'about', 'care', 'reviews', 'contact'];
      const scrollPosition = window.scrollY + 200;
      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(sectionId);
            break;
          }
        }
      }
    };
    window.addEventListener('scroll', handleScrollSpy);
    return () => window.removeEventListener('scroll', handleScrollSpy);
  }, [location.pathname]);

  const scrollToSection = (sectionId) => {
    if (location.pathname !== '/') {
      // If we are not on home, we could navigate to /#sectionId
      window.location.href = `/#${sectionId}`;
      return;
    }
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const adjustCartForActivator = (currentCart) => {
    const slimeItems = currentCart.filter(item => item.id !== 'slime-activator');
    const numSlimes = slimeItems.reduce((acc, item) => acc + item.quantity, 0);
    const activatorIndex = currentCart.findIndex(item => item.id === 'slime-activator');

    if (numSlimes >= 4) {
      if (activatorIndex > -1) {
        const activator = currentCart[activatorIndex];
        if (!activator.isFree || activator.quantity !== 1) {
          const updated = [...currentCart];
          updated[activatorIndex] = {
            ...activator,
            price: 0,
            name: 'FREE GIFT — Slime Activator',
            isFree: true,
            quantity: 1
          };
          return updated;
        }
      } else {
        return [
          ...currentCart,
          {
            id: 'slime-activator',
            name: 'FREE GIFT — Slime Activator',
            price: 0,
            quantity: 1,
            category: 'care',
            image: 'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=600&q=80',
            isFree: true
          }
        ];
      }
    } else {
      if (activatorIndex > -1) {
        const activator = currentCart[activatorIndex];
        if (activator.isFree) {
          return currentCart.filter(item => item.id !== 'slime-activator');
        }
      }
    }
    return currentCart;
  };

  const handleAddToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      let nextCart;
      if (existing) {
        nextCart = prev.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        nextCart = [...prev, { ...product, quantity: 1 }];
      }
      return adjustCartForActivator(nextCart);
    });
    setIsCartOpen(true);
  };

  const handleUpdateQuantity = (productId, newQty) => {
    if (newQty <= 0) return handleRemoveItem(productId);
    setCart((prev) => {
      const nextCart = prev.map((item) => (item.id === productId ? { ...item, quantity: newQty } : item));
      return adjustCartForActivator(nextCart);
    });
  };

  const handleRemoveItem = (productId) => {
    setCart((prev) => {
      const nextCart = prev.filter((item) => item.id !== productId);
      return adjustCartForActivator(nextCart);
    });
  };

  const handleClearCart = () => setCart([]);
  
  const toggleFavorite = async (productId) => {
    const isFav = favorites.includes(productId);
    const updated = isFav 
      ? favorites.filter(id => id !== productId)
      : [...favorites, productId];
      
    setFavorites(updated);
    
    if (currentUser) {
      try {
        await updateWishlist(currentUser.uid, updated);
        toast.success(isFav ? 'Removed from wishlist 🤍' : 'Added to wishlist! 💖');
      } catch (err) {
        toast.error('Could not sync wishlist with database.');
      }
    } else {
      localStorage.setItem('fezyslimes_guest_wishlist', JSON.stringify(updated));
      toast.success(isFav ? 'Removed from wishlist 🤍' : 'Added to wishlist! 💖');
    }
  };

  const prevReview = () => setActiveReviewIndex((prev) => (prev === 0 ? reviews.length - 1 : prev - 1));
  const nextReview = () => setActiveReviewIndex((prev) => (prev === reviews.length - 1 ? 0 : prev + 1));

  const outletContext = {
    scrollToSection,
    handleAddToCart,
    setSelectedProduct,
    toggleFavorite,
    favorites,
    activeReviewIndex,
    prevReview,
    nextReview
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-pink-200 selection:text-slate-900 overflow-x-hidden relative">
      <Toaster position="top-center" toastOptions={{
        style: {
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          border: '1px solid #f1f5f9',
          color: '#1e293b',
          borderRadius: '16px',
          boxShadow: '0 10px 15px -3px rgba(253, 164, 175, 0.1)'
        }
      }} />
      <WelcomePopup />
      <NewsletterPopup />

      {/* Clean Background layer */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-br from-teal-50/60 via-white to-pink-50/60" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar 
          cartCount={cart.reduce((acc, item) => acc + item.quantity, 0)}
          onCartClick={() => setIsCartOpen(true)}
          activeSection={activeSection}
          scrollToSection={scrollToSection}
        />

        <CartDrawer 
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          cartItems={cart}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onClearCart={handleClearCart}
          onAddToCart={handleAddToCart}
        />

        <ProductQuickView 
          product={selectedProduct}
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
        />

        {/* Page Content */}
        <div className="flex-1">
          <Outlet context={outletContext} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="track-order" element={<OrderTracking />} />
            <Route path="account" element={<CustomerDashboard />} />
            <Route path="login" element={<Login />} />
            <Route path="signup" element={<Signup />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="verify-email" element={<VerifyEmail />} />
            <Route path="confirm-order" element={<ConfirmOrder />} />
            {/* Legal pages */}
            <Route path="privacy-policy" element={<PrivacyPolicy />} />
            <Route path="terms" element={<TermsAndConditions />} />
            <Route path="refund-policy" element={<RefundPolicy />} />
            <Route path="faq" element={<FAQ />} />
          </Route>
          {/* Admin routes (standalone, no main layout/navbar) */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/login" element={<AdminLogin />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
