import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Package, ShoppingBag, LogOut, Plus, Trash2, Edit2,
  X, Upload, CheckCircle2, AlertCircle, RefreshCw, Search, Filter,
  TrendingUp, Users, User, DollarSign, Clock, Shield, ChevronDown, Image as ImageIcon, Truck, Settings,
  Eye, MapPin, Mail, Phone, ExternalLink, Calendar, Check, Copy, AlertTriangle, ArrowRight, CreditCard,
  Menu
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ORDER_STATUSES } from '../../services/orderService';
import { storage, db } from '../../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, getDocs, addDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

// ----------------------------------------------------------------
// API base URL — injected from environment variable so it works
// in local dev (localhost:5000) and on Vercel (deployed backend).
// Set VITE_API_BASE in .env.local for local dev, and in Vercel
// project settings for production.
// ----------------------------------------------------------------
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

function useAdminAuth() {
  const navigate = useNavigate();
  const token = localStorage.getItem('fezyslimes_admin_token');

  const authFetch = async (url, options = {}, timeoutMs = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const res = await fetch(`${API_BASE}${url}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${token}`,
          ...(options.headers || {})
        }
      });
      clearTimeout(id);
      
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('fezyslimes_admin_token');
        navigate('/admin/login');
        throw new Error('Session expired. Please log in again.');
      }
      return res;
    } catch (err) {
      clearTimeout(id);
      if (err.name === 'AbortError') {
        throw new Error('Request timed out. The server took too long to respond.');
      }
      throw err;
    }
  };

  return { token, authFetch };
}

const STATUS_COLORS = {
  'Awaiting Payment Confirmation': 'bg-amber-50 text-amber-700 border border-amber-200',
  'Pending': 'bg-amber-50 text-amber-700 border border-amber-200',
  'Order Placed': 'bg-slate-100 text-slate-700 border border-slate-200',
  'Order Confirmed': 'bg-blue-50 text-blue-700 border border-blue-200',
  'Paid': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'Preparing Slime': 'bg-purple-50 text-purple-700 border border-purple-200',
  'Quality Check': 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  'Packaging': 'bg-orange-50 text-orange-700 border border-orange-200',
  'Handed to Courier': 'bg-yellow-50 text-yellow-800 border border-yellow-200',
  'In Transit': 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  'Shipped': 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  'Arrived at Local Hub': 'bg-teal-50 text-teal-700 border border-teal-200',
  'Out for Delivery': 'bg-pink-50 text-pink-700 border border-pink-200',
  'Delivered': 'bg-green-50 text-green-800 border border-green-200',
  'Cancelled': 'bg-rose-50 text-rose-700 border border-rose-200'
};

const CATEGORIES = ['glossy', 'butter', 'clear', 'crunchy', 'foam-bead', 'diy-clay', 'cloud', 'floam'];

// ---- Upload image to Firebase Storage and return the download URL ----
async function uploadImageToFirebase(file) {
  const storageRef = ref(storage, `product-images/${Date.now()}-${file.name.replace(/\s+/g, '_')}`);
  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file);
    uploadTask.on(
      'state_changed',
      null,
      (error) => reject(error),
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadURL);
      }
    );
  });
}

// ---- Stat Card ----
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className={`bg-white border border-slate-100 rounded-2xl p-5 flex items-center gap-4 shadow-sm`}>
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-black text-slate-800">{value}</p>
      </div>
    </div>
  );
}

// ---- Products Section ----
function ProductsSection({ authFetch }) {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const fileInputRef = useRef(null);

  const emptyForm = {
    name: '', description: '', price: '', category: '',
    texture: '', scent: '', stock: '', imageUrl: ''
  };
  const [form, setForm] = useState(emptyForm);
  // Multi-image state: array of { url: string, file: File|null }
  const [imageSlots, setImageSlots] = useState([]); // { preview, file, url }

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      let productList = [];
      try {
        const res = await fetch(`${API_BASE}/api/products`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) productList = data;
        }
      } catch (apiErr) {
        console.warn('[Admin] Backend API fetch failed, trying direct Firestore fallback:', apiErr);
      }

      if (productList.length === 0) {
        const querySnapshot = await getDocs(collection(db, 'products'));
        querySnapshot.forEach((docSnap) => {
          productList.push({ id: docSnap.id, ...docSnap.data() });
        });
      }

      setProducts(productList);
    } catch (err) {
      console.error('[Admin] Failed to load products:', err);
      toast.error('Failed to load products.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadProducts(); }, []);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const newSlots = files.map(file => {
      const preview = URL.createObjectURL(file);
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      return { preview, file, url: '', type };
    });
    setImageSlots(prev => [...prev, ...newSlots]);
    // Reset input so same files can be re-selected if needed
    e.target.value = '';
  };

  const removeImageSlot = (idx) => {
    setImageSlots(prev => prev.filter((_, i) => i !== idx));
  };

  const addImageByUrl = () => {
    const url = form.imageUrl?.trim();
    if (!url) return;
    const type = (url.includes('/video/upload/') || url.match(/\.(mp4|webm|ogg|mov|avi|mkv)($|\?)/i)) ? 'video' : 'image';
    setImageSlots(prev => [...prev, { preview: url, file: null, url, type }]);
    setForm(f => ({ ...f, imageUrl: '' }));
  };

  const openEditForm = (product) => {
    setEditingProduct(product);
    setForm({
      name: product.name || '',
      description: product.description || '',
      price: product.price?.toString() || '',
      category: product.category || '',
      texture: product.texture || '',
      scent: product.scent || '',
      stock: product.stock?.toString() || '',
      imageUrl: ''
    });
    // Build imageSlots from existing images array or fallback single image
    const existingImages = Array.isArray(product.images) && product.images.length > 0
      ? product.images
      : product.image ? [product.image] : [];
    setImageSlots(existingImages.map(url => {
      const type = (url.includes('/video/upload/') || url.match(/\.(mp4|webm|ogg|mov|avi|mkv)($|\?)/i)) ? 'video' : 'image';
      return { preview: url, file: null, url, type };
    }));
    setShowForm(true);
  };

  const openNewForm = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setImageSlots([]);
    setShowForm(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    
    if (!form.name?.trim() || !form.price?.toString().trim()) {
      toast.error('Please fill in required fields (Product Name and Price).');
      return;
    }

    setIsSaving(true);
    setUploadProgress(null);

    try {
      // ---- Step 1: Upload any file-based images/videos to Cloudinary ----
      const resolvedImages = [];
      const filesToUpload = imageSlots.filter(s => s.file);
      let uploadIndex = 0;
      for (let i = 0; i < imageSlots.length; i++) {
        const slot = imageSlots[i];
        if (slot.file) {
          uploadIndex++;
          const isVideo = slot.type === 'video';
          toast.loading(`Uploading ${isVideo ? 'video' : 'image'} ${uploadIndex} of ${filesToUpload.length}...`, { id: 'media-upload' });
          const formData = new FormData();
          formData.append('image', slot.file);
          const uploadRes = await authFetch('/api/admin/upload', { method: 'POST', body: formData });
          if (!uploadRes.ok) {
            toast.dismiss('media-upload');
            throw new Error(`${isVideo ? 'Video' : 'Image'} ${uploadIndex} upload failed`);
          }
          const uploadData = await uploadRes.json();
          resolvedImages.push(uploadData.url);
          toast.dismiss('media-upload');
        } else if (slot.url) {
          resolvedImages.push(slot.url);
        }
      }

      // Find first image for the legacy thumbnail field
      const firstImageUrl = resolvedImages.find(url => !(url.includes('/video/upload/') || url.match(/\.(mp4|webm|ogg|mov|avi|mkv)($|\?)/i))) || resolvedImages[0] || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';

      // ---- Step 2: Prepare product payload ----
      const productPayload = {
        name: form.name.trim(),
        description: form.description || '',
        price: parseFloat(form.price) || 0,
        category: form.category || 'glossy',
        texture: form.texture || '',
        scent: form.scent || '',
        stock: parseInt(form.stock, 10) || 0,
        image: firstImageUrl,          // legacy field — keeps existing products working
        images: resolvedImages,       // new multi-image field
        updatedAt: new Date().toISOString()
      };

      // ---- Step 3: Try backend API or direct Firestore write ----
      let isSaved = false;
      try {
        const url = editingProduct
          ? `/api/admin/products/${editingProduct.id}`
          : '/api/admin/products';
        const method = editingProduct ? 'PUT' : 'POST';

        const res = await authFetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productPayload)
        }, 8000);

        if (res.ok) {
          isSaved = true;
        }
      } catch (apiErr) {
        console.warn('[Admin] API endpoint unreachable, writing directly to Firestore:', apiErr);
      }

      if (!isSaved) {
        if (editingProduct) {
          await setDoc(doc(db, 'products', editingProduct.id), productPayload, { merge: true });
        } else {
          await addDoc(collection(db, 'products'), {
            ...productPayload,
            createdAt: new Date().toISOString()
          });
        }
      }

      toast.success(editingProduct ? 'Product updated! ✨' : 'Product created! 🎉');
      setShowForm(false);
      await loadProducts();
    } catch (err) {
      console.error('[Admin Save Product Error]', err);
      toast.dismiss('img-upload');
      toast.error(err.message || 'Failed to save product.');
    } finally {
      setIsSaving(false);
      setUploadProgress(null);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      let isDeleted = false;
      try {
        const res = await authFetch(`/api/admin/products/${productId}`, { method: 'DELETE' }, 5000);
        if (res.ok) isDeleted = true;
      } catch (apiErr) {
        console.warn('[Admin Delete] API backend unreachable, using direct Firestore delete:', apiErr);
      }

      if (!isDeleted) {
        await deleteDoc(doc(db, 'products', productId));
      }

      toast.success('Product deleted.');
      await loadProducts();
    } catch (err) {
      console.error('[Admin Delete Product Error]', err);
      toast.error(err.message || 'Failed to delete product.');
    }
  };

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Products</h2>
          <p className="text-slate-500 text-sm font-medium">{products.length} product(s) in catalog</p>
        </div>
        <button
          onClick={openNewForm}
          className="flex items-center gap-2 px-5 py-2.5 bg-cyan-400 hover:bg-cyan-500 text-white font-black rounded-xl shadow-md shadow-cyan-200 transition-all active:scale-95 text-sm"
        >
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:border-cyan-400"
        />
      </div>

      {/* Product Add/Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSaveProduct} className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-black text-slate-800">
                  {editingProduct ? 'Edit Product' : 'New Product'}
                </h3>
                <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Product Name *</label>
                  <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-cyan-400" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Price (₦) *</label>
                  <input required type="number" min="0" value={form.price} onChange={e => setForm({...form, price: e.target.value})}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-cyan-400" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Category *</label>
                  <select required value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-cyan-400 appearance-none">
                    <option value="">Select category</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Stock Quantity *</label>
                  <input required type="number" min="0" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-cyan-400" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Texture</label>
                  <input value={form.texture} onChange={e => setForm({...form, texture: e.target.value})}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-cyan-400" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Scent</label>
                  <input value={form.scent} onChange={e => setForm({...form, scent: e.target.value})}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-cyan-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Description *</label>
                <textarea required value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  rows={3} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-cyan-400 resize-none" />
              </div>

              {/* Multi-image/video upload */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">
                  Product Media (Images &amp; Videos)
                  <span className="ml-2 text-cyan-500 font-normal normal-case">Up to 6 files — first image will be the main photo</span>
                </label>

                {/* Media strip */}
                {imageSlots.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {imageSlots.map((slot, idx) => {
                      const isVideo = slot.type === 'video' || (slot.url && (slot.url.includes('/video/upload/') || slot.url.match(/\.(mp4|webm|ogg|mov|avi|mkv)($|\?)/i)));
                      return (
                        <div key={idx} className="relative group">
                          {isVideo ? (
                            <video src={slot.preview} className="w-20 h-20 object-cover rounded-xl border border-slate-200 shrink-0 bg-slate-900" muted playsInline />
                          ) : (
                            <img src={slot.preview} alt={`img-${idx}`} className="w-20 h-20 object-cover rounded-xl border border-slate-200 shrink-0" />
                          )}
                          {idx === 0 && (
                            <span className="absolute bottom-0 left-0 right-0 text-center text-[8px] font-black bg-cyan-400 text-white rounded-b-xl py-0.5">MAIN</span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeImageSlot(idx)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs font-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >×</button>
                        </div>
                      );
                    })}
                    {imageSlots.length < 6 && (
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        className="w-20 h-20 border-2 border-dashed border-slate-200 hover:border-cyan-400 rounded-xl flex items-center justify-center text-slate-400 hover:text-cyan-500 transition-all text-2xl font-light">
                        +
                      </button>
                    )}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap items-center">
                  {imageSlots.length === 0 && (
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-cyan-400 rounded-xl text-xs font-bold text-slate-600 transition-all">
                      <Upload className="w-4 h-4" /> Upload Media
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileChange} className="hidden" />
                  <p className="text-[10px] text-slate-400 font-semibold">— or paste URL —</p>
                  <div className="flex gap-1 flex-1">
                    <input type="url" placeholder="https://..." value={form.imageUrl}
                      onChange={e => setForm({...form, imageUrl: e.target.value})}
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-cyan-400 min-w-0" />
                    <button type="button" onClick={addImageByUrl}
                      className="px-3 py-2 bg-slate-100 hover:bg-cyan-50 hover:text-cyan-600 text-slate-500 font-bold rounded-xl text-xs transition-all">
                      Add
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={isSaving}
                  className="px-5 py-2.5 bg-cyan-400 hover:bg-cyan-500 disabled:bg-slate-300 text-white font-black rounded-xl text-sm transition-all active:scale-95">
                  {isSaving ? 'Saving...' : (editingProduct ? 'Update Product' : 'Create Product')}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-sm transition-all">
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Products Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(product => (
            <div key={product.id} className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="relative h-44 bg-slate-100">
                {(product.images?.[0] || product.image) ? (
                  <img src={product.images?.[0] || product.image} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <ImageIcon className="w-12 h-12" />
                  </div>
                )}
                <span className={`absolute top-3 left-3 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${product.stock > 10 ? 'bg-green-50 text-green-600' : product.stock > 0 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                  {product.stock > 0 ? `${product.stock} in stock` : 'Out of Stock'}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-black text-slate-800 text-sm mb-1 truncate">{product.name}</h3>
                <p className="text-slate-400 text-[11px] font-semibold mb-2 capitalize">{product.category} · {product.texture}</p>
                <p className="font-black text-pink-500 text-base mb-3">₦{(product.price || 0).toLocaleString()}</p>
                <div className="flex gap-2 border-t border-slate-50 pt-3">
                  <button onClick={() => openEditForm(product)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-50 hover:bg-cyan-50 hover:text-cyan-600 text-slate-500 font-bold rounded-xl text-xs transition-all">
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => handleDeleteProduct(product.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-50 hover:bg-red-50 hover:text-red-500 text-slate-500 font-bold rounded-xl text-xs transition-all">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-16 text-slate-400 font-bold">
              No products found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Orders Section ----
function OrdersSection({ authFetch }) {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const [editTrackingId, setEditTrackingId] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      let list = [];
      try {
        const res = await authFetch('/api/admin/orders');
        if (res.ok) {
          const data = await res.json();
          list = Array.isArray(data) ? data : [];
        }
      } catch (e) {
        console.warn('Backend orders fetch failed, attempting Firestore fallback:', e);
      }

      if (list.length === 0) {
        try {
          const snap = await getDocs(collection(db, 'orders'));
          list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (fbErr) {
          console.warn('Firestore fallback failed:', fbErr);
        }
      }

      setOrders(list);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load orders.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, []);

  const openOrderDetail = (order) => {
    setSelectedOrder(order);
    setEditStatus(order.trackingStatus || order.orderStatus || order.deliveryStatus || 'Order Confirmed');
    setEditTrackingId(order.trackingId || '');
  };

  const handleCopyOrderId = (id, e) => {
    if (e) e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(id);
      setCopiedId(id);
      toast.success('Order ID copied! 📋');
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleStatusUpdate = async (statusToSet) => {
    const targetStatus = statusToSet || editStatus;
    if (!selectedOrder || !targetStatus) return;
    setIsUpdating(true);
    try {
      const orderId = selectedOrder.id || selectedOrder.orderId;
      let updated = false;
      try {
        const res = await authFetch(`/api/admin/orders/${orderId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trackingStatus: targetStatus,
            deliveryStatus: targetStatus,
            orderStatus: targetStatus,
            trackingId: editTrackingId
          })
        });
        if (res.ok) updated = true;
      } catch (e) {
        console.warn('Backend status update failed, falling back to Firestore setDoc:', e);
      }

      if (!updated) {
        const orderDocRef = doc(db, 'orders', orderId);
        await setDoc(orderDocRef, {
          trackingStatus: targetStatus,
          deliveryStatus: targetStatus,
          orderStatus: targetStatus,
          trackingId: editTrackingId || null,
          updatedAt: new Date()
        }, { merge: true });
      }

      toast.success(`Order status updated to "${targetStatus}"! ✅`);
      setEditStatus(targetStatus);
      setSelectedOrder(prev => prev ? {
        ...prev,
        trackingStatus: targetStatus,
        deliveryStatus: targetStatus,
        orderStatus: targetStatus,
        trackingId: editTrackingId
      } : null);
      await loadOrders();
    } catch (err) {
      toast.error(err.message || 'Failed to update order status.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmPayment = async (orderId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Are you sure you want to mark this payment as confirmed?")) return;
    setIsUpdating(true);
    try {
      let confirmed = false;
      try {
        const res = await authFetch(`/api/admin/orders/${orderId}/confirm-payment`, {
          method: 'PUT'
        });
        if (res.ok) confirmed = true;
      } catch (e) {
        console.warn('Backend payment confirmation failed, falling back to Firestore setDoc:', e);
      }

      if (!confirmed) {
        const orderDocRef = doc(db, 'orders', orderId);
        await setDoc(orderDocRef, {
          paymentStatus: 'Paid',
          trackingStatus: 'Order Confirmed',
          deliveryStatus: 'Order Confirmed',
          confirmed: true,
          updatedAt: new Date()
        }, { merge: true });
      }

      toast.success('Payment confirmed successfully! 💖');
      if (selectedOrder) {
        setSelectedOrder(prev => prev ? {
          ...prev,
          paymentStatus: 'Paid',
          trackingStatus: 'Order Confirmed',
          deliveryStatus: 'Order Confirmed',
          confirmed: true
        } : null);
        setEditStatus('Order Confirmed');
      }
      await loadOrders();
    } catch (err) {
      toast.error(err.message || 'Failed to confirm payment.');
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    let dateObj;
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      dateObj = timestamp.toDate();
    } else if (timestamp.seconds || timestamp._seconds) {
      dateObj = new Date((timestamp.seconds || timestamp._seconds) * 1000);
    } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      dateObj = new Date(timestamp);
    } else {
      return 'N/A';
    }
    if (isNaN(dateObj.getTime())) return 'N/A';
    return dateObj.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTime = (timestamp) => {
    if (!timestamp) return 0;
    if (timestamp.toDate && typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
    if (timestamp.seconds || timestamp._seconds) return (timestamp.seconds || timestamp._seconds) * 1000;
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      const d = new Date(timestamp);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    }
    return 0;
  };

  // Metrics
  const totalRevenue = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
  const pendingPaymentOrders = orders.filter(o => !o.confirmed && o.paymentStatus !== 'Paid').length;
  const activeOrders = orders.filter(o => !['Delivered', 'Cancelled'].includes(o.trackingStatus || o.orderStatus)).length;
  const deliveredOrders = orders.filter(o => (o.trackingStatus || o.orderStatus) === 'Delivered').length;

  // Filtered list
  const filtered = orders.filter(order => {
    const currentStatus = (order.trackingStatus || order.orderStatus || order.deliveryStatus || 'Pending').toLowerCase();
    
    // Status Filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'awaiting') {
        if (!currentStatus.includes('awaiting') && currentStatus !== 'pending') return false;
      } else if (statusFilter === 'confirmed') {
        if (!currentStatus.includes('confirmed') && currentStatus !== 'paid') return false;
      } else if (statusFilter === 'processing') {
        if (!['preparing slime', 'quality check', 'packaging'].includes(currentStatus)) return false;
      } else if (statusFilter === 'in_transit') {
        if (!['handed to courier', 'in transit', 'arrived at local hub', 'out for delivery', 'shipped'].includes(currentStatus)) return false;
      } else if (statusFilter === 'delivered') {
        if (currentStatus !== 'delivered') return false;
      } else if (statusFilter === 'cancelled') {
        if (currentStatus !== 'cancelled') return false;
      } else if (currentStatus !== statusFilter.toLowerCase()) {
        return false;
      }
    }

    // Payment Filter
    if (paymentFilter !== 'all') {
      if (paymentFilter === 'paid' && !order.confirmed && order.paymentStatus !== 'Paid') return false;
      if (paymentFilter === 'unpaid' && (order.confirmed || order.paymentStatus === 'Paid')) return false;
    }

    // Search Query
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      const matchId = (order.orderId || order.id || '').toLowerCase().includes(query);
      const matchName = (order.customer?.name || '').toLowerCase().includes(query);
      const matchEmail = (order.customer?.email || '').toLowerCase().includes(query);
      const matchPhone = (order.customer?.phone || '').toLowerCase().includes(query);
      const matchItems = Array.isArray(order.items) && order.items.some(i => (i.name || '').toLowerCase().includes(query));
      if (!matchId && !matchName && !matchEmail && !matchPhone && !matchItems) return false;
    }

    return true;
  });

  // Sort
  const sortedOrders = [...filtered].sort((a, b) => {
    if (sortBy === 'oldest') return getTime(a.createdAt) - getTime(b.createdAt);
    if (sortBy === 'amount_high') return (b.amount || 0) - (a.amount || 0);
    if (sortBy === 'amount_low') return (a.amount || 0) - (b.amount || 0);
    return getTime(b.createdAt) - getTime(a.createdAt);
  });

  return (
    <div className="space-y-6">
      {/* Header & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Orders Management</h2>
          <p className="text-slate-500 text-sm font-medium">Manage and track customer orders, payments, and delivery statuses</p>
        </div>
        <button 
          onClick={loadOrders} 
          disabled={isLoading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs shadow-sm transition-all active:scale-95 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 text-cyan-600 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Orders
        </button>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-1">Total Orders</span>
          <span className="text-2xl font-black text-slate-800">{orders.length}</span>
        </div>
        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-500 block mb-1">Awaiting Payment</span>
          <span className="text-2xl font-black text-amber-600">{pendingPaymentOrders}</span>
        </div>
        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
          <span className="text-[11px] font-black uppercase tracking-wider text-cyan-500 block mb-1">Active / In Transit</span>
          <span className="text-2xl font-black text-cyan-600">{activeOrders}</span>
        </div>
        <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
          <span className="text-[11px] font-black uppercase tracking-wider text-green-500 block mb-1">Total Revenue</span>
          <span className="text-2xl font-black text-pink-500">₦{totalRevenue.toLocaleString()}</span>
        </div>
      </div>

      {/* Filters & Search Controls */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search ID, customer, email, product..."
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-cyan-400 focus:bg-white transition-all" 
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select 
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-cyan-400 appearance-none cursor-pointer"
            >
              <option value="all">All Statuses ({orders.length})</option>
              <option value="awaiting">Awaiting Payment ({pendingPaymentOrders})</option>
              <option value="confirmed">Order Confirmed</option>
              <option value="processing">Preparing / Quality / Packaging</option>
              <option value="in_transit">Handed to Courier / In Transit</option>
              <option value="delivered">Delivered ({deliveredOrders})</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Payment Status Filter */}
          <div className="relative">
            <select 
              value={paymentFilter} 
              onChange={e => setPaymentFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-cyan-400 appearance-none cursor-pointer"
            >
              <option value="all">All Payment States</option>
              <option value="paid">Paid & Confirmed</option>
              <option value="unpaid">Awaiting Payment</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Sort By */}
          <div className="relative">
            <select 
              value={sortBy} 
              onChange={e => setSortBy(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-cyan-400 appearance-none cursor-pointer"
            >
              <option value="newest">Sort: Date (Newest First)</option>
              <option value="oldest">Sort: Date (Oldest First)</option>
              <option value="amount_high">Sort: Amount (High to Low)</option>
              <option value="amount_low">Sort: Amount (Low to High)</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Active Filter summary */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1 pt-1 font-medium">
          <span>Showing <strong className="text-slate-800">{sortedOrders.length}</strong> of {orders.length} orders</span>
          {(searchTerm || statusFilter !== 'all' || paymentFilter !== 'all' || sortBy !== 'newest') && (
            <button 
              onClick={() => { setSearchTerm(''); setStatusFilter('all'); setPaymentFilter('all'); setSortBy('newest'); }}
              className="text-cyan-600 hover:text-cyan-700 font-bold hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
          <p className="text-slate-400 text-sm font-bold">Loading orders database...</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-slate-100 shadow-sm bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="text-left px-5 py-3.5 text-[11px] font-black text-slate-400 uppercase tracking-wider">Order ID</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-black text-slate-400 uppercase tracking-wider">Customer</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-black text-slate-400 uppercase tracking-wider">Items</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-black text-slate-400 uppercase tracking-wider">Amount</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-black text-slate-400 uppercase tracking-wider">Order Status</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-black text-slate-400 uppercase tracking-wider">Payment</th>
                <th className="text-left px-5 py-3.5 text-[11px] font-black text-slate-400 uppercase tracking-wider">Date Placed</th>
                <th className="text-right px-5 py-3.5 text-[11px] font-black text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedOrders.map(order => {
                const totalItemsCount = Array.isArray(order.items) 
                  ? order.items.reduce((sum, item) => sum + (item.quantity || 1), 0)
                  : 0;
                const statusStr = order.trackingStatus || order.orderStatus || order.deliveryStatus || 'Pending';
                const isPaid = order.confirmed || order.paymentStatus === 'Paid';

                return (
                  <tr 
                    key={order.id || order.orderId} 
                    onClick={() => openOrderDetail(order)}
                    className="hover:bg-cyan-50/30 transition-colors cursor-pointer group"
                  >
                    {/* Order ID */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 font-mono text-xs font-black text-cyan-600 group-hover:text-cyan-700">
                        <span>{order.orderId || order.id}</span>
                        <button 
                          onClick={(e) => handleCopyOrderId(order.orderId || order.id, e)}
                          title="Copy Order ID"
                          className="p-1 text-slate-300 hover:text-cyan-600 rounded transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-800 text-xs truncate max-w-[140px]">{order.customer?.name || 'Guest Customer'}</p>
                      <p className="text-slate-400 text-[11px] font-medium truncate max-w-[140px]">{order.customer?.email}</p>
                    </td>

                    {/* Items */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-black rounded-md">
                          {totalItemsCount} item{totalItemsCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="px-5 py-4 font-black text-slate-800 text-xs whitespace-nowrap">
                      ₦{(order.amount || 0).toLocaleString()}
                    </td>

                    {/* Order Status */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${STATUS_COLORS[statusStr] || 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                        {statusStr}
                      </span>
                    </td>

                    {/* Payment Status */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-600 border border-amber-200">
                          <Clock className="w-3 h-3" /> Awaiting
                        </span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-5 py-4 text-[11px] font-medium text-slate-500 whitespace-nowrap">
                      {formatDate(order.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {!isPaid && (
                          <button
                            onClick={(e) => handleConfirmPayment(order.id || order.orderId, e)}
                            disabled={isUpdating}
                            title="Confirm Payment Received"
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-[10px] transition-all flex items-center gap-1 border border-emerald-100"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Confirm
                          </button>
                        )}
                        <button
                          onClick={() => openOrderDetail(order)}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-cyan-50 text-slate-600 hover:text-cyan-600 font-bold rounded-xl text-[10px] transition-all flex items-center gap-1 border border-slate-100"
                        >
                          <Eye className="w-3 h-3" /> View Details
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sortedOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-20 text-slate-400">
                    <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-1" />
                    <p className="font-bold text-sm text-slate-600">No orders match your criteria</p>
                    <p className="text-xs text-slate-400 mt-1">Try resetting the search filters or placing a new order on the storefront.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ORDER DETAIL MODAL                                                        */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" 
            />

            {/* Modal Body */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white border border-slate-100 rounded-[2rem] p-6 sm:p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto relative z-10 shadow-2xl space-y-6 font-sans"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-2xl font-black text-slate-800">Order Details</h3>
                    <span className="font-mono text-sm px-2.5 py-0.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-lg font-black flex items-center gap-1">
                      {selectedOrder.orderId || selectedOrder.id}
                      <button 
                        onClick={(e) => handleCopyOrderId(selectedOrder.orderId || selectedOrder.id, e)}
                        className="hover:text-cyan-900 transition-colors"
                        title="Copy Order ID"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Placed on {formatDate(selectedOrder.createdAt)}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-bold text-slate-600">
                      Payment Method: {selectedOrder.paymentMethod || 'Bank Transfer'}
                    </span>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedOrder(null)} 
                  className="p-2.5 text-slate-400 hover:text-pink-500 hover:bg-pink-50 rounded-2xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Header Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tracking Status:</span>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${STATUS_COLORS[selectedOrder.trackingStatus || selectedOrder.orderStatus || 'Pending'] || 'bg-slate-100 text-slate-600'}`}>
                    {selectedOrder.trackingStatus || selectedOrder.orderStatus || 'Pending'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment:</span>
                  {selectedOrder.confirmed || selectedOrder.paymentStatus === 'Paid' ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed / Paid
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase bg-amber-50 text-amber-600 border border-amber-200">
                        <Clock className="w-3.5 h-3.5" /> Awaiting Payment
                      </span>
                      <button
                        onClick={(e) => handleConfirmPayment(selectedOrder.id || selectedOrder.orderId, e)}
                        disabled={isUpdating}
                        className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Mark Paid
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Main 2-Column Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Side: Items & Financial Breakdown */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Items List Card */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
                        <Package className="w-4 h-4 text-cyan-500" /> Ordered Items ({Array.isArray(selectedOrder.items) ? selectedOrder.items.length : 0})
                      </h4>
                    </div>

                    <div className="space-y-3 divide-y divide-slate-50 max-h-[280px] overflow-y-auto pr-1">
                      {Array.isArray(selectedOrder.items) && selectedOrder.items.map((item, idx) => (
                        <div key={item.id || idx} className="pt-3 first:pt-0 flex items-center gap-3">
                          <img 
                            src={item.image || '/logo.png'} 
                            alt={item.name} 
                            className="w-14 h-14 rounded-xl object-cover border border-slate-100 shrink-0 bg-slate-50"
                            onError={(e) => { e.target.src = '/logo.png'; }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h5 className="font-black text-slate-800 text-xs truncate">{item.name}</h5>
                              <span className="font-black text-slate-800 text-xs whitespace-nowrap">
                                ₦{((item.price || 0) * (item.quantity || 1)).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 font-medium">
                              {item.isFree ? (
                                <span className="px-2 py-0.5 bg-pink-50 text-pink-600 border border-pink-100 rounded-md font-black text-[10px] uppercase">
                                  🎁 Free Gift
                                </span>
                              ) : (
                                <span>₦{(item.price || 0).toLocaleString()} × {item.quantity || 1}</span>
                              )}
                              {item.texture && (
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase">
                                  {item.texture}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pricing Breakdown Card */}
                  <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-5 space-y-3">
                    <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider">Payment Breakdown</h4>
                    <div className="space-y-2 text-xs font-medium text-slate-600">
                      <div className="flex justify-between">
                        <span>Items Subtotal:</span>
                        <span className="font-bold text-slate-800">
                          ₦{(Array.isArray(selectedOrder.items) 
                            ? selectedOrder.items.reduce((acc, i) => acc + (i.price || 0) * (i.quantity || 1), 0)
                            : (selectedOrder.amount || 0) - (selectedOrder.deliveryFee || 0)
                          ).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Delivery Fee ({selectedOrder.selectedCourier || 'Standard'}):</span>
                        <span className="font-bold text-slate-800">₦{(selectedOrder.deliveryFee || 0).toLocaleString()}</span>
                      </div>
                      <div className="border-t border-slate-200 pt-2 flex justify-between text-base">
                        <span className="font-black text-slate-800">Total Amount:</span>
                        <span className="font-black text-pink-500 text-lg">₦{(selectedOrder.amount || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side: Customer Details & Status Update Form */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Customer Information */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
                    <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                      <User className="w-3.5 h-3.5 text-cyan-500" /> Customer Information
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-slate-400 font-bold block text-[10px] uppercase">Full Name</span>
                        <span className="font-black text-slate-800">{selectedOrder.customer?.name || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block text-[10px] uppercase">Email Address</span>
                        <a href={`mailto:${selectedOrder.customer?.email}`} className="font-bold text-cyan-600 hover:underline flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {selectedOrder.customer?.email || 'N/A'}
                        </a>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block text-[10px] uppercase">Phone Number</span>
                        <a href={`tel:${selectedOrder.customer?.phone}`} className="font-bold text-cyan-600 hover:underline flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {selectedOrder.customer?.phone || 'N/A'}
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Delivery Address & Logistics */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
                    <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                      <MapPin className="w-3.5 h-3.5 text-pink-500" /> Delivery Address & Courier
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-slate-400 font-bold block text-[10px] uppercase">Address</span>
                        <span className="font-medium text-slate-700">{selectedOrder.customer?.address || 'No address provided'}</span>
                      </div>
                      {selectedOrder.customer?.landmark && (
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px] uppercase">Landmark</span>
                          <span className="font-medium text-slate-600">{selectedOrder.customer.landmark}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 text-[11px]">
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px] uppercase">Delivery Zone</span>
                          <span className="font-bold text-slate-800">{selectedOrder.selectedZone || 'Standard Zone'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px] uppercase">Courier</span>
                          <span className="font-bold text-slate-800">{selectedOrder.selectedCourier || 'DHL'}</span>
                        </div>
                      </div>
                      {selectedOrder.customer?.notes && (
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-2">
                          <span className="text-slate-400 font-bold block text-[10px] uppercase">Customer Notes</span>
                          <p className="text-slate-600 italic text-[11px] mt-0.5">{selectedOrder.customer.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Management Form */}
                  <div className="bg-gradient-to-br from-cyan-50/50 via-white to-pink-50/50 border border-cyan-100 rounded-2xl p-5 shadow-sm space-y-4">
                    <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-cyan-100/60 pb-2">
                      <Truck className="w-3.5 h-3.5 text-cyan-600" /> Update Status & Logistics
                    </h4>

                    {/* Status Dropdown */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Change Order Status</label>
                      <select 
                        value={editStatus} 
                        onChange={e => setEditStatus(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:border-cyan-400 focus:outline-none shadow-sm"
                      >
                        <option value="Awaiting Payment Confirmation">Awaiting Payment Confirmation</option>
                        <option value="Order Placed">Order Placed</option>
                        <option value="Order Confirmed">Order Confirmed</option>
                        <option value="Preparing Slime">Preparing Slime</option>
                        <option value="Quality Check">Quality Check</option>
                        <option value="Packaging">Packaging</option>
                        <option value="Handed to Courier">Handed to Courier</option>
                        <option value="In Transit">In Transit</option>
                        <option value="Arrived at Local Hub">Arrived at Local Hub</option>
                        <option value="Out for Delivery">Out for Delivery</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>

                    {/* Quick status shortcut buttons */}
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Quick Actions</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleStatusUpdate('Order Confirmed')}
                          disabled={isUpdating}
                          className="px-2.5 py-1.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 text-blue-600 font-bold rounded-xl text-[11px] transition-all"
                        >
                          ✓ Confirm Order
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusUpdate('In Transit')}
                          disabled={isUpdating}
                          className="px-2.5 py-1.5 bg-white hover:bg-cyan-50 border border-slate-200 hover:border-cyan-200 text-cyan-600 font-bold rounded-xl text-[11px] transition-all"
                        >
                          🚀 In Transit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusUpdate('Delivered')}
                          disabled={isUpdating}
                          className="px-2.5 py-1.5 bg-white hover:bg-green-50 border border-slate-200 hover:border-green-200 text-green-600 font-bold rounded-xl text-[11px] transition-all"
                        >
                          📦 Delivered
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusUpdate('Cancelled')}
                          disabled={isUpdating}
                          className="px-2.5 py-1.5 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-rose-600 font-bold rounded-xl text-[11px] transition-all"
                        >
                          ✕ Cancel Order
                        </button>
                      </div>
                    </div>

                    {/* Tracking ID */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Courier Tracking ID (Optional)</label>
                      <input 
                        type="text" 
                        placeholder="e.g. DHL-984729"
                        value={editTrackingId}
                        onChange={e => setEditTrackingId(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:border-cyan-400 focus:outline-none shadow-sm"
                      />
                    </div>

                    {/* Save Button */}
                    <button
                      type="button"
                      onClick={() => handleStatusUpdate()}
                      disabled={isUpdating}
                      className="w-full py-3 bg-cyan-400 hover:bg-cyan-500 disabled:bg-slate-300 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md shadow-cyan-200 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      {isUpdating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      {isUpdating ? 'Saving Changes...' : 'Save Order Status'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- Overview Section ----
function OverviewSection({ authFetch }) {
  const [stats, setStats] = useState({ totalOrders: 0, totalRevenue: 0, pendingOrders: 0, confirmedOrders: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true);
      try {
        const [ordersRes, productsRes] = await Promise.all([
          authFetch('/api/admin/orders'),
          fetch(`${API_BASE}/api/products`)
        ]);
        const orders = await ordersRes.json();
        const products = await productsRes.json();

        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
        const pendingOrders = orders.filter(o => !['Delivered', 'Out for Delivery'].includes(o.trackingStatus)).length;
        const confirmedOrders = orders.filter(o => o.confirmed).length;

        setStats({ totalOrders, totalRevenue, pendingOrders, confirmedOrders, totalProducts: Array.isArray(products) ? products.length : 0 });
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    loadStats();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-800">Dashboard Overview</h2>
        <p className="text-slate-500 text-sm font-medium">Store performance at a glance</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <StatCard icon={ShoppingBag} label="Total Orders" value={stats.totalOrders} color="bg-cyan-400" />
          <StatCard icon={DollarSign} label="Total Revenue" value={`₦${stats.totalRevenue.toLocaleString()}`} color="bg-pink-400" />
          <StatCard icon={Clock} label="Active Orders" value={stats.pendingOrders} color="bg-amber-400" />
          <StatCard icon={Package} label="Products" value={stats.totalProducts || 0} color="bg-teal-500" />
        </div>
      )}

      <div className="bg-gradient-to-br from-cyan-50 to-teal-50 border border-cyan-100 rounded-3xl p-6">
        <h3 className="text-lg font-black text-slate-800 mb-2">Quick Actions</h3>
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="px-4 py-2 bg-white border border-cyan-100 rounded-xl text-xs font-bold text-cyan-600 shadow-sm">
            ✅ {stats.confirmedOrders} confirmed orders
          </div>
          <div className="px-4 py-2 bg-white border border-amber-100 rounded-xl text-xs font-bold text-amber-600 shadow-sm">
            ⏳ {stats.pendingOrders} orders pending dispatch
          </div>
          <div className="px-4 py-2 bg-white border border-pink-100 rounded-xl text-xs font-bold text-pink-600 shadow-sm">
            💰 ₦{stats.totalRevenue.toLocaleString()} total revenue
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Shipping Rates Settings Section ----
function ShippingRatesSection({ authFetch }) {
  const [zones, setZones] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  // New zone form state
  const [newLabel, setNewLabel] = useState('');
  const [newState, setNewState] = useState('');
  const [newCourier, setNewCourier] = useState('DHL');
  const [newRate, setNewRate] = useState('');

  useEffect(() => {
    const loadRates = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/shipping-rates`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setZones(data);
        }
      } catch (err) {
        toast.error('Failed to load shipping rates.');
      } finally {
        setIsLoading(false);
      }
    };
    loadRates();
  }, []);

  const handleRateChange = (idx, value) => {
    const numericVal = value === '' ? 0 : parseInt(value, 10);
    setZones(prev => prev.map((z, i) => i === idx ? { ...z, rate: isNaN(numericVal) ? 0 : numericVal } : z));
  };

  const handleRemoveZone = (idx) => {
    if (!window.confirm('Remove this delivery zone?')) return;
    setZones(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddZone = () => {
    if (!newLabel.trim() || !newState.trim() || newRate === '') {
      toast.error('Please fill in Zone Name, State, and Rate.');
      return;
    }
    const key = `${newState.replace(/\s+/g, '')}-${newCourier}-${Date.now()}`;
    setZones(prev => [...prev, {
      key,
      label: newLabel.trim(),
      state: newState.trim(),
      courier: newCourier,
      rate: parseInt(newRate, 10) || 0
    }]);
    setNewLabel(''); setNewState(''); setNewCourier('DHL'); setNewRate('');
    toast.success('Zone added — click Save to confirm.');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await authFetch('/api/admin/shipping-rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zones })
      });
      if (!res.ok) throw new Error('Failed to update shipping rates.');
      toast.success('Shipping rates saved! 🚚');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-black text-slate-800">Shipping &amp; Delivery Rates</h2>
        <p className="text-slate-500 text-sm font-medium">Add, remove, and edit delivery zones. Changes reflect live on the Contact page and checkout immediately after saving.</p>
      </div>

      {/* Existing zones */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
        {zones.length === 0 && (
          <p className="text-slate-400 text-sm font-medium text-center py-4">No delivery zones yet. Add one below.</p>
        )}
        {zones.map((zone, idx) => (
          <div key={zone.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-700">{zone.label}</p>
              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">State: {zone.state} · Courier: {zone.courier || 'DHL'}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-[150px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₦</span>
                <input
                  type="number"
                  min="0"
                  value={zone.rate ?? ''}
                  onChange={(e) => handleRateChange(idx, e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-800 focus:outline-none focus:border-cyan-400 transition-colors"
                />
              </div>
              <button
                onClick={() => handleRemoveZone(idx)}
                title="Remove zone"
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add new zone */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
        <h3 className="text-base font-black text-slate-700 flex items-center gap-2">
          <Plus className="w-4 h-4 text-cyan-500" /> Add New Delivery Zone
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Zone Label (shown to customers)</label>
            <input
              type="text"
              placeholder="e.g. Kano State (DHL)"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-cyan-400"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">State / Region</label>
            <input
              type="text"
              placeholder="e.g. Kano State"
              value={newState}
              onChange={e => setNewState(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-cyan-400"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Courier</label>
            <select
              value={newCourier}
              onChange={e => setNewCourier(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-cyan-400 appearance-none"
            >
              <option value="DHL">DHL</option>
              <option value="Uber">Uber</option>
              <option value="Gokada">Gokada</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Rate (₦)</label>
            <input
              type="number"
              min="0"
              placeholder="e.g. 6000"
              value={newRate}
              onChange={e => setNewRate(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleAddZone}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-xl text-sm transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add Zone
        </button>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-3.5 bg-cyan-400 hover:bg-cyan-500 disabled:bg-slate-200 text-white font-black rounded-2xl shadow-lg shadow-cyan-200 transition-all active:scale-95 text-base flex items-center justify-center gap-2"
      >
        {isSaving ? 'Saving Rates...' : 'Save Shipping Rates'}
      </button>
    </div>
  );
}

// ---- Settings Section ----
function SettingsSection({ authFetch }) {
  const [bankDetails, setBankDetails] = useState({ bankName: '', accountNumber: '', accountName: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadBankDetails = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/bank-details`);
        if (res.ok) {
          const data = await res.json();
          if (data.bankName) setBankDetails(data);
        }
      } catch (err) {
        toast.error('Failed to load bank details.');
      } finally {
        setIsLoading(false);
      }
    };
    loadBankDetails();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await authFetch('/api/admin/settings/bank-details', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bankDetails)
      });
      if (!res.ok) throw new Error('Failed to update bank details.');
      toast.success('Bank details updated successfully! 🏦');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-black text-slate-800">Store Settings</h2>
        <p className="text-slate-500 text-sm font-medium">Configure bank account details for manual transfers</p>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Bank Name</label>
            <input required value={bankDetails.bankName} onChange={e => setBankDetails({...bankDetails, bankName: e.target.value})} placeholder="e.g. GTBank" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-cyan-400" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Account Number</label>
            <input required value={bankDetails.accountNumber} onChange={e => setBankDetails({...bankDetails, accountNumber: e.target.value})} placeholder="e.g. 0123456789" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-cyan-400" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Account Name</label>
            <input required value={bankDetails.accountName} onChange={e => setBankDetails({...bankDetails, accountName: e.target.value})} placeholder="e.g. Fezy Slimes Ltd" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-cyan-400" />
          </div>
        </div>

        <button type="submit" disabled={isSaving} className="w-full py-3.5 bg-cyan-400 hover:bg-cyan-500 disabled:bg-slate-200 text-white font-black rounded-2xl shadow-lg shadow-cyan-200 transition-all active:scale-95 text-base flex items-center justify-center gap-2">
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}

// ---- Main Admin Dashboard ----
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const token = localStorage.getItem('fezyslimes_admin_token');

  const authFetch = async (url, options = {}) => {
    const res = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {})
      }
    });
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('fezyslimes_admin_token');
      navigate('/admin/login');
      throw new Error('Session expired.');
    }
    return res;
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (!token) {
      navigate('/admin/login');
    }
  }, [token, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('fezyslimes_admin_token');
    toast.success('Logged out of admin panel.');
    navigate('/admin/login');
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'shipping_rates', label: 'Shipping Rates', icon: Truck },
    { id: 'settings', label: 'Store Settings', icon: Settings },
  ];

  if (!token) return null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex">
      {/* Mobile Sidebar Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)} 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-20 md:hidden"
        />
      )}

      {/* Sidebar */}
      <div className={`w-64 shrink-0 bg-slate-900 text-white flex flex-col fixed inset-y-0 left-0 z-30 transition-transform duration-300 ease-in-out md:translate-x-0 ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Brand */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-black text-white text-sm leading-tight">FezySlimes</p>
              <p className="text-slate-500 text-[11px] font-bold">Admin Panel</p>
            </div>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)} 
            className="md:hidden p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                  activeTab === tab.id
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Bottom: Logout */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
          <a href="/" target="_blank" rel="noopener noreferrer"
            className="mt-2 w-full flex items-center justify-center gap-2 py-2 text-[11px] font-bold text-slate-600 hover:text-slate-400 transition-colors">
            ↗ View Storefront
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div className="md:ml-64 flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)} 
              className="md:hidden p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-black text-slate-800 capitalize">{activeTab}</h1>
              <p className="text-xs font-medium text-slate-400">FezySlimes Admin Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-100 rounded-full">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[11px] font-black text-green-600 uppercase tracking-wider">Admin Active</span>
            </div>
          </div>
        </header>

        {/* Tab Content */}
        <main className="flex-1 p-4 sm:p-8">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            {activeTab === 'overview' && <OverviewSection authFetch={authFetch} />}
            {activeTab === 'products' && <ProductsSection authFetch={authFetch} />}
            {activeTab === 'orders' && <OrdersSection authFetch={authFetch} />}
            {activeTab === 'shipping_rates' && <ShippingRatesSection authFetch={authFetch} />}
            {activeTab === 'settings' && <SettingsSection authFetch={authFetch} />}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
