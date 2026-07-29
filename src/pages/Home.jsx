import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Flame, 
  HelpCircle, 
  Check, 
  MessageSquare, 
  Mail, 
  MapPin, 
  ShieldAlert,
  Camera,
  Heart,
  Search,
  RefreshCw,
  AlertCircle,
  Play,
  X
} from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { categories } from '../data';
import CustomerReviews from '../components/CustomerReviews';
import { fetchProducts, API_BASE } from '../services/productService';
import toast from 'react-hot-toast';

import productVideo from '../assets/5992522466562415265.mp4';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState(null);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [shippingZones, setShippingZones] = useState([]);

  // Prevent body scrolling when video lightbox is open
  useEffect(() => {
    document.body.style.overflow = isVideoModalOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isVideoModalOpen]);

  const { 
    scrollToSection, 
    handleAddToCart, 
    setSelectedProduct, 
    toggleFavorite, 
    favorites
  } = useOutletContext();

  // Fetch products from the shared Firestore backend / direct Firestore
  const loadProducts = async () => {
    setIsLoadingProducts(true);
    setProductsError(null);
    try {
      const data = await fetchProducts();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[Home] Failed to load products:', err);
      setProductsError('Could not load products. Please try again.');
    } finally {
      setIsLoadingProducts(false);
    }
  };

  useEffect(() => {
    setIsLoadingProducts(true);
    loadProducts();
  }, []);

  // Fetch live shipping zones from admin-managed settings
  useEffect(() => {
    fetch(`${API_BASE}/api/shipping-rates`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setShippingZones(data); })
      .catch(() => {});
  }, []);

  const filteredProducts = products.filter(prod => {
    const matchesSearch = prod.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = 
      selectedCategory === 'all' || 
      prod.category === selectedCategory ||
      prod.category?.toLowerCase() === selectedCategory?.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };
  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section id="home" className="relative min-h-[85vh] flex items-center justify-center pt-28 pb-16 overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 w-full text-center relative z-10">
          <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-6 flex flex-col items-center">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 backdrop-blur-md border border-white shadow-sm text-cyan-600 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-pink-400" /> Nigeria's Most Trusted Slime Brand
            </motion.div>
            
            <motion.h1 variants={fadeUp} className="text-5xl sm:text-7xl font-black tracking-tight text-slate-800 leading-[1.1]">
              Nigeria's First <br/>
              <span className="bg-gradient-to-r from-cyan-400 via-teal-400 to-pink-400 bg-clip-text text-transparent">
                Premium Handmade
              </span>{' '}
              Slimes
            </motion.h1>

            <motion.p variants={fadeUp} className="text-lg text-slate-600 max-w-2xl leading-relaxed font-medium">
              We aren't your average slime shop! We specialize in various slime textures made from imported ingredients. Our slimes are made for all ages <span className="inline-block align-middle leading-none select-none text-base mx-0.5">🤗</span>.
            </motion.p>

            <motion.div variants={fadeUp} className="bg-white/60 backdrop-blur-md border border-white/60 shadow-lg shadow-pink-100/50 rounded-2xl p-4 flex items-center gap-4 max-w-md w-full justify-center">
              <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center text-pink-500 font-black text-lg border border-white shadow-sm shrink-0">
                100+
              </div>
              <div className="text-sm text-left">
                <span className="font-bold text-slate-800 block">Orders Shipped Nationwide</span>
                <span className="text-xs text-slate-500 font-medium">Handmade with love &amp; premium elements <span className="inline-block align-middle leading-none select-none text-sm text-pink-400 font-black mx-0.5">♡</span></span>
              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-4 pt-2">
              <button onClick={() => scrollToSection('shop')} className="px-8 py-4 bg-cyan-400 hover:bg-cyan-500 text-white font-black rounded-2xl shadow-lg shadow-cyan-200 transition-all hover:-translate-y-1 active:scale-95 text-base flex items-center gap-2">
                Shop Now
              </button>
              <button onClick={() => scrollToSection('categories')} className="px-8 py-4 bg-white/80 hover:bg-white border border-white/60 text-slate-700 font-bold rounded-2xl shadow-md shadow-slate-200/50 transition-all hover:-translate-y-1 active:scale-95 text-base">
                Explore Slimes
              </button>
            </motion.div>

            {/* Featured Product Showcase Video Card (Tappable Lightbox Trigger) */}
            <motion.div 
              variants={fadeUp}
              onClick={() => setIsVideoModalOpen(true)}
              className="w-full max-w-2xl mt-6 relative rounded-[2.5rem] overflow-hidden border-4 border-white bg-white/70 shadow-2xl shadow-pink-100/60 group cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-cyan-300"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setIsVideoModalOpen(true)}
              aria-label="Click to expand showcase video full screen"
            >
              <video
                src={productVideo}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                aria-label="FezySlimes handmade slime product showcase video"
                className="w-full h-auto aspect-video sm:aspect-[16/9] object-cover rounded-[2.2rem]"
              />

              {/* Play / Expand Cue Overlay */}
              <div className="absolute inset-0 bg-slate-900/20 group-hover:bg-slate-900/35 transition-all flex items-center justify-center">
                <div className="px-5 py-3 rounded-full bg-white/90 backdrop-blur-md shadow-xl border border-white text-slate-800 font-extrabold text-xs flex items-center gap-2.5 group-hover:scale-105 transition-transform">
                  <div className="w-8 h-8 rounded-full bg-cyan-400 text-white flex items-center justify-center shadow-md">
                    <Play fill="currentColor" className="w-4 h-4 ml-0.5" />
                  </div>
                  <span>Tap to view full screen 🔊</span>
                </div>
              </div>

              <div className="absolute bottom-4 left-4 right-4 bg-white/85 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/80 shadow-md flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Live ASMR Slime Texture</span>
                </div>
                <span className="text-[11px] font-bold text-pink-500 bg-pink-50 px-2.5 py-1 rounded-lg border border-pink-100">
                  Handmade in Lagos ✨
                </span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Lightbox / Fullscreen Video Modal */}
      <AnimatePresence>
        {isVideoModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-8">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsVideoModalOpen(false)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md cursor-pointer"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative z-10 w-full max-w-4xl max-h-[90vh] flex flex-col items-center justify-center"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsVideoModalOpen(false)}
                className="absolute -top-12 right-0 sm:-right-12 sm:top-0 text-white/80 hover:text-white p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full transition-all z-20 hover:rotate-90 duration-300"
                aria-label="Close video lightbox"
              >
                <X className="w-7 h-7 text-white" />
              </button>

              {/* Video Wrapper */}
              <div 
                className="relative w-full rounded-[2rem] overflow-hidden shadow-2xl bg-black border border-white/20 cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                <video
                  src={productVideo}
                  controls
                  autoPlay
                  playsInline
                  className="w-full max-h-[80vh] object-contain rounded-[2rem]"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Combined Shop & Textures Section */}
      <section id="shop" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-left space-y-2">
              <h2 className="text-3xl sm:text-5xl font-black text-slate-800">Shop premium slimes.</h2>
              <p className="text-base text-slate-500 font-medium font-sans">Handcrafted weekly with premium pigments and lots of love.</p>
            </motion.div>
            
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="flex flex-wrap items-center gap-3">
              {/* Functional Search Bar */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search slimes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white border border-slate-200 rounded-full pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all shadow-sm min-w-[220px]"
                />
              </div>
            </motion.div>
          </div>

          {/* Texture Categories Row */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="flex flex-wrap gap-2.5 mb-10 pb-4 border-b border-slate-100">
            <button 
              onClick={() => setSelectedCategory('all')} 
              className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl border transition-all ${
                selectedCategory === 'all' 
                  ? 'bg-cyan-500 border-cyan-400 text-white shadow-md' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              All Textures
            </button>
            {categories.map((cat) => (
              <button 
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)} 
                className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl border transition-all ${
                  selectedCategory === cat.id 
                    ? 'bg-cyan-500 border-cyan-400 text-white shadow-md' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {cat.title.replace(' Slimes', '')}
              </button>
            ))}
          </motion.div>

          {/* Activator Promo Strip */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="mb-10 bg-gradient-to-r from-pink-50 via-white to-cyan-50 border border-pink-100 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row items-center justify-center text-center sm:text-left gap-4">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0 border border-pink-100">
              <span className="text-2xl">💖</span>
            </div>
            <div>
              <h4 className="text-slate-800 font-black text-lg">Don't forget your activator!</h4>
              <p className="text-slate-600 font-medium text-sm">A slime activator is required with every order — <span className="text-pink-500 font-bold">orders of 4+ slimes get one FREE!</span></p>
            </div>
          </motion.div>

          {/* Product Grid — Loading / Error / Data states */}
          {isLoadingProducts ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <RefreshCw className="w-10 h-10 text-cyan-400 animate-spin" />
              <p className="text-slate-400 font-semibold text-sm">Loading slimes...</p>
            </div>
          ) : productsError ? (
            <div className="flex flex-col items-center justify-center py-20 bg-red-50/60 border border-red-100 backdrop-blur-md rounded-3xl p-8 text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
              <h3 className="text-lg font-black text-slate-800">Failed to load products</h3>
              <p className="text-sm text-slate-500 mt-1 mb-6">{productsError}</p>
              <button 
                onClick={loadProducts} 
                className="px-5 py-2.5 bg-cyan-400 hover:bg-cyan-500 text-white font-black rounded-xl text-xs shadow-md flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center text-center py-20 bg-white/40 border border-white/60 backdrop-blur-md rounded-3xl p-8">
              <span className="text-5xl mb-4">🐼</span>
              <h3 className="text-xl font-black text-slate-800">No matching slimes found</h3>
              <p className="text-sm text-slate-500 font-medium mt-1">Try resetting your search query or filters.</p>
              <button 
                onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }} 
                className="mt-6 px-5 py-2.5 bg-cyan-400 hover:bg-cyan-500 text-white font-black rounded-xl text-xs shadow-md"
              >
                Reset Filters
              </button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredProducts.map((prod, i) => {
                const isOutOfStock = (prod.stock ?? 1) <= 0;
                return (
                  <motion.div key={prod.id} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay: i * 0.05 }} className="bg-white/70 backdrop-blur-md border border-white rounded-[2rem] overflow-hidden shadow-xl shadow-teal-50/50 hover:shadow-pink-100/60 flex flex-col justify-between group transition-all duration-300 hover:-translate-y-2">
                    <div className="relative h-80 overflow-hidden bg-slate-100">
                      <img src={prod.image} alt={prod.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      
                      {/* Out of Stock badge */}
                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
                          <span className="bg-white/95 backdrop-blur-sm text-slate-700 font-black text-sm px-4 py-2 rounded-full border border-white shadow-md">
                            Out of Stock
                          </span>
                        </div>
                      )}

                      <div className="absolute top-4 right-4 flex flex-col gap-2">
                        <button onClick={() => toggleFavorite(prod.id)} className={`p-3 rounded-2xl border backdrop-blur-md transition-all shadow-sm ${favorites.includes(prod.id) ? 'bg-pink-500 border-pink-400 text-white' : 'bg-white/80 border-white text-slate-400 hover:text-pink-500 hover:bg-white'}`}>
                          <Heart className={`w-5 h-5 ${favorites.includes(prod.id) ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    </div>

                    <div className="p-6 text-left space-y-4">
                      <div className="flex justify-between items-start gap-4">
                        <h3 className="font-black text-slate-800 text-lg leading-tight group-hover:text-cyan-500 transition-colors">{prod.name}</h3>
                        <span className="font-black text-pink-500 text-lg shrink-0">₦{(prod.price || 0).toLocaleString()}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <button 
                          onClick={() => setSelectedProduct(prod)} 
                          className="py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600 rounded-2xl transition-all active:scale-95"
                        >
                          Quick View
                        </button>
                        <button 
                          onClick={() => !isOutOfStock && handleAddToCart(prod)} 
                          disabled={isOutOfStock}
                          className={`py-3 text-xs font-black rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                            isOutOfStock 
                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                              : 'bg-cyan-400 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-150'
                          }`}
                        >
                          {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-[3rem] p-8 lg:p-16 shadow-2xl shadow-pink-100/50">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-5 flex justify-center">
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ type: "spring", damping: 18, stiffness: 160 }}
                  className="relative flex items-center justify-center"
                >
                  {/* Soft glow backing so logo doesn't get lost */}
                  <div className="absolute w-72 h-72 sm:w-80 sm:h-80 rounded-full bg-gradient-to-br from-pink-200/60 via-cyan-100/50 to-teal-200/60 blur-2xl" />
                  <img
                    src="/logo.png"
                    alt="FezySlimes Logo"
                    className="relative w-64 sm:w-80 lg:w-96 h-auto object-contain animate-bob drop-shadow-2xl"
                  />
                </motion.div>
              </div>

              <div className="lg:col-span-7 text-left space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-100 border border-pink-200 text-pink-500 text-xs font-bold uppercase tracking-wider">
                  Our Story
                </div>
                <h2 className="text-4xl sm:text-5xl font-black text-slate-800">About FezySlimes</h2>
                <div className="space-y-4 text-slate-600 text-lg font-medium leading-relaxed">
                  <p>Hii 🤍!</p>
                  <p>We are <strong>Tire &amp; Tase</strong>, the founders of FezySlimes — Nigeria's first premium slime brand!</p>
                  <p>We started making slimes back in <strong>2023</strong> because we wanted to bring stress relief, creativity, and pure fun to everyone.</p>
                  <p>Every single slime is handmade with love, tested thoroughly for quality, and designed to give you the most satisfying ASMR texture clicks.</p>
                </div>
                <div className="pt-6 flex flex-wrap items-center gap-6 text-sm font-bold text-slate-700">
                  <span className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100"><Check className="w-5 h-5 text-cyan-500" /> Handmade locally</span>
                  <span className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100"><Check className="w-5 h-5 text-cyan-500" /> Imported ingredients</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Slime Care Guidelines */}
      <section id="care" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center max-w-xl mx-auto mb-16 space-y-4">
            <h2 className="text-3xl sm:text-5xl font-black text-slate-800">Slime Care Guide</h2>
            <p className="text-base text-slate-500 font-medium">Read these recommendations to keep your slime soft, clicky, and fresh.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="bg-red-50 border border-red-100 rounded-[2rem] p-8 text-left space-y-4 shadow-lg shadow-red-100/50 hover:-translate-y-1 transition-transform">
              <div className="w-14 h-14 rounded-2xl bg-white border border-red-100 flex items-center justify-center text-red-400 shadow-sm">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Warnings</h3>
              <ul className="space-y-3 text-sm text-slate-600 font-medium list-disc pl-4 marker:text-red-300">
                <li>Slime is <strong>NOT edible</strong>. Do not consume.</li>
                <li>Contains glue, borax, scents, and non-edible materials.</li>
                <li>Not suitable for children under 6 years old.</li>
              </ul>
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay: 0.1 }} className="bg-gradient-to-br from-cyan-100 to-teal-50 border border-cyan-200 rounded-[2rem] p-8 text-left space-y-4 md:scale-105 shadow-xl shadow-cyan-100/50 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-cyan-400 text-white font-black text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-bl-2xl shadow-sm">
                Active Life
              </div>
              <div className="w-14 h-14 rounded-2xl bg-white border border-cyan-100 flex items-center justify-center text-cyan-400 shadow-sm">
                <Flame className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Tips &amp; Maintenance</h3>
              <p className="text-sm text-cyan-600 font-bold">With proper care, slimes last between 3–5 months!</p>
              <ul className="space-y-3 text-sm text-slate-700 font-medium list-disc pl-4 marker:text-cyan-400">
                <li>Wash hands before playing.</li>
                <li>Play on clean surfaces only.</li>
                <li>Store inside airtight containers.</li>
                <li>Keep away from heat sources.</li>
                <li>Use slime activator if slime melts.</li>
              </ul>
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} transition={{ delay: 0.2 }} className="bg-white/80 border border-slate-200 rounded-[2rem] p-8 text-left space-y-4 shadow-lg shadow-slate-200/50 hover:-translate-y-1 transition-transform">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm">
                <HelpCircle className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Health &amp; Skin</h3>
              <ul className="space-y-3 text-sm text-slate-600 font-medium list-disc pl-4 marker:text-slate-300">
                <li>Our slimes are <strong>NON-TOXIC</strong>.</li>
                <li>Some users with sensitive skin may react to Borax.</li>
                <li>Sensitive skin types should avoid prolonged contact.</li>
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className="py-24 relative">
        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-12">
            <h2 className="text-3xl sm:text-5xl font-black text-slate-800">Customer Reviews</h2>
          </motion.div>

          {/* Real customer photo & video gallery */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            variants={fadeUp}
            className="mt-10"
          >
            <CustomerReviews />
          </motion.div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 bg-white/60 backdrop-blur-xl border border-white/80 rounded-[3rem] p-8 lg:p-12 shadow-2xl shadow-pink-100/40">
            
            <div className="text-left space-y-8 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-100 border border-cyan-200 text-cyan-600 text-xs font-bold uppercase tracking-wider">
                    Contact Us
                  </div>
                  <h2 className="text-3xl sm:text-5xl font-black text-slate-800">Let's Connect</h2>
                  <p className="text-base text-slate-600 font-medium leading-relaxed max-w-md">
                    Have questions about textures, custom birthday orders, or shipping? Chat with Tire &amp; Tase directly!
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <a href="https://wa.me/2349155577753" target="_blank" rel="noreferrer" className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-lg hover:border-cyan-300 transition-all flex items-start gap-4 group">
                    <div className="p-4 bg-green-50 text-green-500 rounded-2xl group-hover:bg-green-500 group-hover:text-white transition-all">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="block text-xs text-slate-400 font-bold uppercase">WhatsApp Chat</span>
                      <span className="text-base text-slate-800 font-black block mt-1">09155577753</span>
                      <span className="text-xs text-cyan-500 font-bold block mt-2 group-hover:underline">Send message &rarr;</span>
                    </div>
                  </a>

                  <a href="mailto:fezyslimes@gmail.com" className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-lg hover:border-pink-300 transition-all flex items-start gap-4 group">
                    <div className="p-4 bg-pink-50 text-pink-500 rounded-2xl group-hover:bg-pink-500 group-hover:text-white transition-all">
                      <Mail className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="block text-xs text-slate-400 font-bold uppercase">Email Support</span>
                      <span className="text-base text-slate-800 font-black block mt-1">fezyslimes@gmail.com</span>
                      <span className="text-xs text-pink-500 font-bold block mt-2 group-hover:underline">Write email &rarr;</span>
                    </div>
                  </a>
                </div>
              </div>

              {/* Resized compact location supporting note */}
              <div className="bg-slate-50/90 border border-slate-200/70 p-3.5 sm:p-4 rounded-xl flex items-center gap-3 shadow-xs text-left mt-3 max-w-lg">
                <div className="p-2 bg-white rounded-lg text-cyan-600 shadow-xs border border-slate-100 flex-shrink-0">
                  <MapPin className="w-4 h-4 text-cyan-500" />
                </div>
                <div>
                  <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1">
                    Lagos, Nigeria
                  </h5>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-normal leading-snug mt-0.5">
                    Every product is handmade in Lagos, Nigeria and shipped securely nationwide with tracked delivery.
                  </p>
                </div>
              </div>
            </div>

            {/* Formatted Shipping Rates Table */}
            <div className="bg-slate-50/80 border border-slate-100 p-6 sm:p-8 rounded-3xl space-y-6 text-left flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-black text-slate-800 text-lg flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-cyan-500" /> Shipping Rates
                  </h4>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nationwide</span>
                </div>
                
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider">
                        <th className="py-3 px-4 sm:px-6">Location</th>
                        <th className="py-3 px-4 sm:px-6 text-right">Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                      {shippingZones.length > 0 ? shippingZones.map((zone) => (
                        <tr key={zone.key} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 sm:px-6 text-slate-800 font-bold">{zone.label}</td>
                          <td className="py-3 px-4 sm:px-6 text-right font-black text-pink-500">₦{(zone.rate || 0).toLocaleString()}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={2} className="py-6 text-center text-slate-400 text-sm font-medium">Loading rates...</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-xs text-slate-400 font-semibold text-center pt-2">
                * Rates are calculated automatically during checkout based on your delivery address.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white/80 backdrop-blur-lg border-t border-slate-200 pt-16 pb-8 relative z-10 mt-auto">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 text-left">
          <div className="space-y-6">
            <img src="/logo.png" alt="FezySlimes" className="h-20 w-auto drop-shadow-sm" />
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              Nigeria's first premium slime brand. Elevating sensory ASMR experiences with imported ingredients and lots of love.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 mb-6">Quick Links</h4>
            <div className="flex flex-col gap-4">
              {['home', 'shop', 'about', 'care', 'reviews', 'contact'].map((section) => (
                <button key={section} onClick={() => scrollToSection(section)} className="text-sm text-slate-500 hover:text-cyan-500 transition-colors text-left font-bold uppercase tracking-wide">
                  {section === 'care' ? 'Slime Care' : section}
                </button>
              ))}
              <a href="/track-order" className="text-sm text-slate-500 hover:text-cyan-500 transition-colors font-bold uppercase tracking-wide">Track Order</a>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 mb-6">Socials</h4>
            <div className="flex flex-col gap-4">
              <a href="https://instagram.com/fezyslimes" target="_blank" rel="noreferrer" className="text-sm text-slate-500 hover:text-pink-500 transition-colors font-bold flex items-center gap-2">
                <Camera className="w-4 h-4"/> Instagram - @fezyslimes
              </a>
              <a href="https://tiktok.com/@Fezyslimes" target="_blank" rel="noreferrer" className="text-sm text-slate-500 hover:text-pink-500 transition-colors font-bold flex items-center gap-2">
                <Camera className="w-4 h-4"/> TikTok - @Fezyslimes
              </a>
              <a href="https://snapchat.com/add/fezyslimes.ng" target="_blank" rel="noreferrer" className="text-sm text-slate-500 hover:text-pink-500 transition-colors font-bold flex items-center gap-2">
                <Camera className="w-4 h-4"/> Snapchat - fezyslimes.ng
              </a>
              <a href="https://wa.me/2349155577753" target="_blank" rel="noreferrer" className="text-sm text-slate-500 hover:text-green-500 transition-colors font-bold flex items-center gap-2">
                <MessageSquare className="w-4 h-4"/> WhatsApp Us
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 mb-6">Legal &amp; Support</h4>
            <div className="flex flex-col gap-4">
              <a href="/terms" className="text-sm text-slate-500 hover:text-cyan-500 transition-colors font-bold">Terms &amp; Conditions</a>
              <a href="/privacy-policy" className="text-sm text-slate-500 hover:text-cyan-500 transition-colors font-bold">Privacy Policy</a>
              <a href="/refund-policy" className="text-sm text-slate-500 hover:text-cyan-500 transition-colors font-bold">Return / Refund Policy</a>
              <a href="/faq" className="text-sm text-slate-500 hover:text-cyan-500 transition-colors font-bold">FAQ</a>
            </div>
            <div className="mt-8">
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 mb-3">Quality Guarantee</h4>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">
                All ingredients are child-safe and non-toxic. Premium stretch and quality guaranteed in every batch.
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 border-t border-slate-100 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400 font-bold">
          <span>&copy; {new Date().getFullYear()} FezySlimes. All rights reserved.</span>
          <span className="flex items-center gap-1">Made with 🤍 in Lagos, Nigeria.</span>
        </div>
      </footer>
    </div>
  );
}
