import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Play } from 'lucide-react';

const imageModules = import.meta.glob(
  '/src/assets/reviews/images/*.{jpg,jpeg,png,gif,webp}',
  { eager: true, query: '?url', import: 'default' }
);
const videoModules = import.meta.glob(
  '/src/assets/reviews/videos/*.{mp4,webm,ogg,mov}',
  { eager: true, query: '?url', import: 'default' }
);

const imageItems = Object.values(imageModules).map((src, index) => ({
  type: 'image',
  src,
  id: `img-${index}`
}));

const videoItems = Object.values(videoModules).map((src, index) => ({
  type: 'video',
  src,
  id: `vid-${index}`
}));

const allItems = [...imageItems, ...videoItems];

function ReviewVideo({ src }) {
  const videoRef = useRef(null);
  const [isIntersected, setIsIntersected] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsIntersected(true);
            el.play().catch((err) => {
              console.error('[ReviewVideo] Autoplay failed:', err);
            });
          } else {
            el.pause();
          }
        });
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={videoRef}
      src={isIntersected ? src : undefined}
      className="h-full w-full object-cover"
      loop
      muted
      playsInline
      preload="none"
      onError={(e) => console.error('[ReviewVideo] Load error:', e, src)}
    />
  );
}

function ScrollButton({ direction, onClick }) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      className="hidden md:flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-md shadow-pink-100/60 border border-white hover:text-cyan-500 hover:-translate-y-0.5 transition-all"
      aria-label={direction === 'left' ? 'Scroll reviews left' : 'Scroll reviews right'}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

function ReviewRow({ label, items, onSelect, delay = 0 }) {
  const rowRef = useRef(null);

  if (items.length === 0) return null;

  const scrollRow = (direction) => {
    const row = rowRef.current;
    if (!row) return;
    row.scrollBy({
      left: direction * Math.min(row.clientWidth * 0.85, 520),
      behavior: 'smooth'
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between gap-4 px-1">
        <h3 className="text-lg sm:text-xl font-black text-slate-800">
          {label}
        </h3>
        <div className="flex items-center gap-2">
          <ScrollButton direction="left" onClick={() => scrollRow(-1)} />
          <ScrollButton direction="right" onClick={() => scrollRow(1)} />
        </div>
      </div>

      <div
        ref={rowRef}
        className="flex gap-3 sm:gap-4 overflow-x-auto overflow-y-hidden pb-4 snap-x snap-mandatory scroll-smooth overscroll-x-contain [-webkit-overflow-scrolling:touch]"
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className="group relative shrink-0 snap-start w-[58vw] max-w-[220px] sm:w-[220px] md:w-[240px] lg:w-[260px] aspect-[4/3] overflow-hidden rounded-[1.35rem] border-4 border-white bg-white/70 shadow-lg shadow-pink-100/60 cursor-pointer focus:outline-none focus:ring-4 focus:ring-cyan-200"
          >
            {item.type === 'video' ? (
              <>
                <ReviewVideo src={item.src} />
                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <div className="w-12 h-12 rounded-full bg-white/45 backdrop-blur-md flex items-center justify-center text-white shadow-lg">
                    <Play fill="currentColor" className="w-5 h-5 ml-1" />
                  </div>
                </div>
              </>
            ) : (
              <img
                src={item.src}
                alt=""
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                onError={(e) => console.error('[CustomerReviews] Image load error:', e, item.src)}
              />
            )}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

export default function CustomerReviews() {
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    document.body.style.overflow = selectedItem ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedItem]);

  if (allItems.length === 0) return null;

  const navigateItem = (e, direction) => {
    e.stopPropagation();
    const idx = allItems.findIndex((item) => item.id === selectedItem.id);
    let nextIdx = idx + direction;
    if (nextIdx < 0) nextIdx = allItems.length - 1;
    if (nextIdx >= allItems.length) nextIdx = 0;
    setSelectedItem(allItems[nextIdx]);
  };

  return (
    <div className="w-full space-y-10 overflow-hidden">
      <ReviewRow label="Photo Reviews" items={imageItems} onSelect={setSelectedItem} />
      <ReviewRow label="Video Reviews" items={videoItems} onSelect={setSelectedItem} delay={0.1} />

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
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative z-10 w-full max-w-5xl max-h-full flex items-center justify-center"
            >
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="absolute top-4 right-4 sm:-right-12 sm:top-0 text-white/80 hover:text-white p-2.5 bg-slate-900/50 sm:bg-transparent rounded-full transition-colors z-20 hover:rotate-90 duration-300"
              >
                <X className="w-6 h-6 sm:w-8 sm:h-8" />
              </button>

              {allItems.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => navigateItem(e, -1)}
                    className="absolute left-2 sm:-left-16 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-2 hover:bg-white/10 rounded-full transition-all z-20 backdrop-blur-md"
                  >
                    <ChevronLeft className="w-10 h-10" />
                  </button>
                  <button
                    type="button"
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
                    alt=""
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
