import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, Sparkles, Smile } from 'lucide-react';

export default function ProductQuickView({ product, isOpen, onClose, onAddToCart }) {
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
            className="relative bg-white/90 backdrop-blur-xl border border-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl shadow-pink-100/50 flex flex-col md:flex-row z-10"
          >
            {/* Close Button */}
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 z-20 p-2.5 bg-white/80 hover:bg-white text-slate-400 hover:text-pink-500 rounded-2xl transition-all border border-white shadow-sm hover:shadow-md"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Product Image */}
            <div className="md:w-1/2 relative h-64 md:h-auto min-h-[300px] bg-slate-50">
              <img 
                src={product.image} 
                alt={product.name} 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-white/90" />
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
