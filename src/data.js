export const categories = [
  {
    id: 'glossy',
    title: 'Glossy Slimes',
    description: 'Ultra-shiny, satisfyingly clicky, and perfect for bubble pops.',
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'butter',
    title: 'Butter Slimes',
    description: 'Soft, spreadable slimes made with premium clay. Unbelievably holdable.',
    image: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'clear',
    title: 'Clear Slimes',
    description: 'Glass-like transparency. Beautiful for ASMR stretching.',
    image: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'crunchy',
    title: 'Crunchy Slimes',
    description: 'Packed with beads, crystals, or pebbles for maximum crunch.',
    image: 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'foam-bead',
    title: 'Foam Bead Slimes',
    description: 'Classic Floam texture offering crunchy squishes and airy pops.',
    image: 'https://images.unsplash.com/photo-1502691876148-a84978e59fa8?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'diy-clay',
    title: 'DIY Clay Kit Slimes',
    description: 'Assemble your own dessert or creature and mix it yourself!',
    image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'cloud',
    title: 'Cloud Slimes',
    description: 'Drizzly, fluffy snow textures that feel like holding a real cloud.',
    image: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?auto=format&fit=crop&w=600&q=80',
  }
];

/**
 * PRODUCTS REMOVED FROM THIS FILE.
 *
 * Products are now stored in Firebase Firestore (collection: "products")
 * and managed exclusively through the Admin Dashboard.
 *
 * Storefront pages fetch them from: GET /api/products  (via productService.js)
 * Admin CRUD writes to:            POST/PUT/DELETE /api/admin/products
 *
 * Do NOT re-add a hardcoded products array here.
 */


export const reviews = [
  {
    id: 1,
    name: "TikToker NAYNAY",
    role: "Content Creator",
    rating: 5,
    text: "Literally the best slime texture I have ever touched! The ASMR is out of this world. FezySlimes is a game changer in Nigeria! 😭💖",
    videoUrl: "",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80"
  },
  {
    id: 2,
    name: "Actress Chisom Oguike",
    role: "Official Partner",
    rating: 5,
    text: "So satisfying! I play with my Coquette Cocoa Slime after a long day of filming and it completely relieves my stress. Absolute premium quality.",
    videoUrl: "",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"
  },
  {
    id: 3,
    name: "Amina Y.",
    role: "Verified Buyer, Lagos",
    rating: 5,
    text: "Shipping was incredibly fast to Lekki! The slime came with borax activator and a care guide. 10/10 shopping experience, will order again!",
    videoUrl: "",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80"
  },
  {
    id: 4,
    name: "Femi O.",
    role: "Verified Buyer, Abuja",
    rating: 5,
    text: "Amazing textures. My kids play with the DIY Clay Kits for hours. Love that they use high quality non-toxic materials.",
    videoUrl: "",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80"
  }
];

export const shippingLocations = [
  { name: 'Lagos', price: 2500 },
  { name: 'Ibadan', price: 3500 },
  { name: 'Ogun State', price: 3000 },
  { name: 'Oyo State', price: 3500 },
  { name: 'Abuja', price: 5000 },
  { name: 'Port Harcourt', price: 4500 }
];
