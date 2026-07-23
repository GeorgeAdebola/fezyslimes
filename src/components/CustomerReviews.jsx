import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Play } from 'lucide-react';

// Vite glob import — paths are relative to project root and must be static strings
// With { eager: true } on media assets, each module value IS the URL string directly
const imageModules = import.meta.glob(
  '/src/assets/reviews/images/*.{jpg,jpeg,png,gif,webp}',
  { eager: true, query: '?url', import: 'default' }
);
const videoModules = import.meta.glob(
  '/src/assets/reviews/videos/*.{mp4,webm,ogg,mov}',
  { eager: true, query: '?url', import: 'default' }
);

const images = Object.values(imageModules);
const videos = Object.values(videoModules);

console.log('[CustomerReviews] images found:', images.length, images);
console.log('[CustomerReviews] videos found:', videos.length, videos);

// Interleave images and videos for variety
const buildItems = (imgs, vids) => {
  const combined = [];
  const maxLength = Math.max(imgs.length, vids.length);
  for (let i = 0; i < maxLength; i++) {
    if (imgs[i]) combined.push({ type: 'image', src: imgs[i], id: `img-${i}` });
    if (vids[i]) combined.push({ type: 'video', src: vids[i], id: `vid-${i}` });
  }
  return combined;
};

const items = buildItems(images, videos);

// Video card with IntersectionObserver autoplay
function ReviewVideo({ src }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.play().catch((err) => {
              console.error('[ReviewVideo] Autoplay failed:', err);
            });
          } else {
            el.pause();
          }
        });
      },
      { threshold: 0.4 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={videoRef}
      src={src}
      className="w-full h-auto object-cover"
      loop
      muted
      playsInline
      preload="metadata"
      onError={(e) => console.error('[ReviewVideo] Load error:', e, src)}
    />
  );
}

// Empty state
function EmptyState() {
  return (
    <div className="col-span-full text-center py-20 space-y-3">
      <span className="text-5xl">🤍</span>
      <p className="text-lg font-black text-slate-700">Reviews coming soon!</p>
      <p className="text-sm text-slate-400 font-medium">
        Drop images or videos into{' '}
        <code className="bg-slate-100 px-2 py-0.5 rounded text-xs">
          src/assets/reviews/images/
        </code>{' '}
        or{' '}
        <code className="bg-slate-100 px-2 py-0.5 rounded text-xs">
          src/assets/reviews/videos/
        </code>
      </p>
    </div>
  );
}

export default function CustomerReviews() {
  const [selectedItem, setSelectedItem] = useState(null);

  // Lock scroll when lightbox is open
  useEffect(() => {
    if (selectedItem) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedItem]);

  if (items.length === 0) {
    return (
      <div className="grid grid-cols-1">
        <EmptyState />
      </div>
    );
  }

  // Split into 3 columns for masonry feel
  const col1 = items.filter((_, i) => i % 3 === 0);
  const col2 = items.filter((_, i) => i % 3 === 1);
  const col3 = items.filter((_, i) => i % 3 === 2);

  const renderItem = (item, delay = 0) => (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay }}
      className="w-full rounded-[2rem] overflow-hidden border-4 border-white shadow-lg bg-white/40 backdrop-blur-sm cursor-pointer relative group"
      onClick={() => setSelectedItem(item)}
    >
      {item.type === 'video' ? (
        <>
          <ReviewVideo src={item.src} />
          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <div className="w-12 h-12 rounded-full bg-white/40 backdrop-blur-md flex items-center justify-center text-white shadow-lg">
              <Play fill="currentColor" className="w-5 h-5 ml-1" />
            </div>
          </div>
        </>
      ) : (
        <div className="overflow-hidden">
          <img
            src={item.src}
            alt="Customer review"
            className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            onError={(e) => console.error('[CustomerReviews] Image load error:', e, item.src)}
          />
        </div>
      )}
    </motion.div>
  );

  const navigateItem = (e, direction) => {
    e.stopPropagation();
    const idx = items.findIndex(i => i.id === selectedItem.id);
    let nextIdx = idx + direction;
    if (nextIdx < 0) nextIdx = items.length - 1;
    if (nextIdx >= items.length) nextIdx = 0;
    setSelectedItem(items[nextIdx]);
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
        <div className="flex flex-col gap-6">{col1.map((item) => renderItem(item, 0))}</div>
        <div className="flex flex-col gap-6">{col2.map((item) => renderItem(item, 0.1))}</div>
        <div className="flex flex-col gap-6">{col3.map((item) => renderItem(item, 0.2))}</div>
      </div>

      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm cursor-zoom-out"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative z-10 w-full max-w-5xl max-h-full flex items-center justify-center"
            >
              <button
                onClick={() => setSelectedItem(null)}
                className="absolute -top-12 right-0 sm:-right-12 sm:top-0 text-white/70 hover:text-white p-2 transition-colors z-20 hover:rotate-90 duration-300"
              >
                <X className="w-8 h-8" />
              </button>

              {items.length > 1 && (
                <>
                  <button
                    onClick={(e) => navigateItem(e, -1)}
                    className="absolute left-2 sm:-left-16 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-2 hover:bg-white/10 rounded-full transition-all z-20 backdrop-blur-md"
                  >
                    <ChevronLeft className="w-10 h-10" />
                  </button>
                  <button
                    onClick={(e) => navigateItem(e, 1)}
                    className="absolute right-2 sm:-right-16 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-2 hover:bg-white/10 rounded-full transition-all z-20 backdrop-blur-md"
                  >
                    <ChevronRight className="w-10 h-10" />
                  </button>
                </>
              )}

              <div 
                className="relative rounded-[2rem] overflow-hidden shadow-2xl bg-black border border-white/10 cursor-default" 
                onClick={(e) => e.stopPropagation()}
              >
                {selectedItem.type === 'video' ? (
                  <video
                    src={selectedItem.src}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-[85vh] w-auto max-w-full object-contain rounded-[2rem]"
                  />
                ) : (
                  <img
                    src={selectedItem.src}
                    alt="Customer Review Full"
                    className="max-h-[85vh] w-auto max-w-full object-contain rounded-[2rem]"
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
