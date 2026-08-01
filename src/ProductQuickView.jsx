import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, Sparkles, Smile, ChevronLeft, ChevronRight } from 'lucide-react';
import { optimizeCloudinaryUrl } from './services/productService';

// Image gallery slider with arrow nav + dot indicators + swipe support
function ImageGallery({ images }) {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(null);
  const total = images.length;

  const prev = () => setCurrent(i => (i - 1 + total) % total);
  const next = () => setCurrent(i => (i + 1) % total);

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) dx < 0 ? next() : prev();
    touchStartX.current = null;
  };

  if (total === 0) return null;

  const rawUrl = images[current];
  const url = optimizeCloudinaryUrl(rawUrl, 800);
  const isVideo = rawUrl && (rawUrl.includes('/video/upload/') || rawUrl.match(/\.(mp4|webm|ogg|mov|avi|mkv)($|\?)/i));

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-slate-50 select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Media (Images or Videos) */}
      <AnimatePresence mode="wait" initial={false}>
        {isVideo ? (
          <motion.video
            key={current}
            src={url}
            controls
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 w-full h-full object-cover bg-black"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.22 }}
          />
        ) : (
          <motion.img
            key={current}
            src={url}
            alt={`Product media ${current + 1}`}
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.22 }}
            draggable={false}
          />
        )}
      </AnimatePresence>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-white/90 pointer-events-none" />

      {/* Arrows — only show when > 1 image */}
      {total > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/80 hover:bg-white text-slate-600 rounded-full shadow-md border border-white/60 transition-all hover:scale-105 active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/80 hover:bg-white text-slate-600 rounded-full shadow-md border border-white/60 transition-all hover:scale-105 active:scale-95"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Dot indicators */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`rounded-full transition-all ${
                  i === current
                    ? 'w-4 h-2 bg-cyan-400'
                    : 'w-2 h-2 bg-white/60 hover:bg-white'
                }`}
              />
            ))}
          </div>

          {/* Counter badge */}
          <div className="absolute top-3 right-3 z-10 px-2 py-0.5 bg-black/30 backdrop-blur-sm rounded-full text-[10px] font-black text-white">
            {current + 1}/{total}
          </div>
        </>
      )}
    </div>
  );
}

export default function ProductQuickView({ product, isOpen, onClose, onAddToCart }) {
  // Normalize: support both single `image` string and `images` array
  const images = (() => {
    if (!product) return [];
    if (Array.isArray(product.images) && product.images.length > 0) return product.images;
    if (product.image) return [product.image];
    return [];
  })();

  return (
    <AnimatePresence>
      {isOpen && product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" 
          />

          {/* Modal Content */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative bg-white/90 backdrop-blur-xl border border-white rounded-[3rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-pink-100/50 flex flex-col md:flex-row z-10"
          >
            {/* Close Button */}
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 z-20 p-2.5 bg-white/80 hover:bg-white text-slate-400 hover:text-pink-500 rounded-2xl transition-all border border-white shadow-sm hover:shadow-md"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Product Image Gallery */}
            <div className="md:w-1/2 relative h-64 md:h-auto min-h-[300px]">
              <ImageGallery images={images} />
            </div>

            {/* Product Details */}
            <div className="md:w-1/2 p-8 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-cyan-50 border border-cyan-100 text-cyan-600 px-3 py-1 rounded-full font-black uppercase tracking-wider shadow-sm">
                    {product.texture}
                  </span>
                </div>
                
                <h3 className="text-3xl font-black text-slate-800 leading-tight">{product.name}</h3>
                
                <div className="text-2xl font-black text-pink-500">
                  ₦{product.price.toLocaleString()}
                </div>

                <p className="text-slate-500 text-sm leading-relaxed font-medium">
                  {product.description}
                </p>

                <div className="grid grid-cols-2 gap-3 pt-4">
                  <div className="bg-white border border-slate-100 p-4 rounded-2xl flex flex-col gap-1 shadow-sm">
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-500" /> Scent
                    </div>
                    <span className="text-sm text-slate-800 font-bold truncate block">{product.scent}</span>
                  </div>
                  <div className="bg-white border border-slate-100 p-4 rounded-2xl flex flex-col gap-1 shadow-sm">
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <Smile className="w-3.5 h-3.5 text-pink-400" /> ASMR Feel
                    </div>
                    <span className="text-sm text-slate-800 font-bold">Premium Squish</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 mt-4">
                <button
                  onClick={() => {
                    onAddToCart(product);
                    onClose();
                  }}
                  className="w-full py-4 bg-cyan-400 hover:bg-cyan-500 text-white font-black rounded-2xl shadow-lg shadow-cyan-200 transition-all flex items-center justify-center gap-2 text-base active:scale-95"
                >
                  <ShoppingCart className="w-5 h-5" /> Add to Cart
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
