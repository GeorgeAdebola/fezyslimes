import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Package, ShoppingBag, LogOut, Plus, Trash2, Edit2,
  X, Upload, CheckCircle2, AlertCircle, RefreshCw, Search, Filter,
  TrendingUp, Users, DollarSign, Clock, Shield, ChevronDown, Image as ImageIcon, Truck, Settings
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
  'Order Placed': 'bg-slate-100 text-slate-600',
  'Order Confirmed': 'bg-blue-50 text-blue-600',
  'Preparing Slime': 'bg-purple-50 text-purple-600',
  'Quality Check': 'bg-indigo-50 text-indigo-600',
  'Packaging': 'bg-orange-50 text-orange-600',
  'Handed to Courier': 'bg-yellow-50 text-yellow-600',
  'In Transit': 'bg-cyan-50 text-cyan-600',
  'Arrived at Local Hub': 'bg-teal-50 text-teal-600',
  'Out for Delivery': 'bg-pink-50 text-pink-600',
  'Delivered': 'bg-green-50 text-green-600',
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
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [trackingId, setTrackingId] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/admin/orders');
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      // Sort: newest first
      list.sort((a, b) => {
        const aSecs = a.createdAt?.seconds || a.createdAt?._seconds || 0;
        const bSecs = b.createdAt?.seconds || b.createdAt?._seconds || 0;
        const aTime = a.createdAt?.toMillis?.() || new Date(aSecs * 1000).getTime();
        const bTime = b.createdAt?.toMillis?.() || new Date(bSecs * 1000).getTime();
        return bTime - aTime;
      });
      setOrders(list);
    } catch (err) {
      toast.error('Failed to load orders.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, []);

  const handleStatusUpdate = async () => {
    if (!selectedOrder || !newStatus) return;
    setIsUpdating(true);
    try {
      const res = await authFetch(`/api/admin/orders/${selectedOrder.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingStatus: newStatus, deliveryStatus: newStatus, trackingId })
      });
      if (!res.ok) throw new Error('Failed to update status.');
      toast.success('Order status updated! ✅');
      setSelectedOrder(null);
      await loadOrders();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmPayment = async (orderId) => {
    if (!window.confirm("Are you sure you want to mark this payment as confirmed?")) return;
    setIsUpdating(true);
    try {
      const res = await authFetch(`/api/admin/orders/${orderId}/confirm-payment`, {
        method: 'PUT'
      });
      if (!res.ok) throw new Error('Failed to confirm payment.');
      toast.success('Payment confirmed successfully! ✅');
      await loadOrders();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const dateObj = timestamp.toDate ? timestamp.toDate() : new Date((timestamp.seconds || timestamp._seconds || 0) * 1000);
    return dateObj.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const filtered = orders.filter(o =>
    o.orderId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.customer?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Orders</h2>
          <p className="text-slate-500 text-sm font-medium">{orders.length} total order(s)</p>
        </div>
        <button onClick={loadOrders} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition-all">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Search by order ID, name, or email..."
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:border-cyan-400" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-slate-100 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-5 py-3.5 text-xs font-black text-slate-400 uppercase tracking-wider">Order ID</th>
                <th className="text-left px-5 py-3.5 text-xs font-black text-slate-400 uppercase tracking-wider">Customer</th>
                <th className="text-left px-5 py-3.5 text-xs font-black text-slate-400 uppercase tracking-wider">Amount</th>
                <th className="text-left px-5 py-3.5 text-xs font-black text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3.5 text-xs font-black text-slate-400 uppercase tracking-wider">Confirmed</th>
                <th className="text-left px-5 py-3.5 text-xs font-black text-slate-400 uppercase tracking-wider">Date</th>
                <th className="text-left px-5 py-3.5 text-xs font-black text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(order => (
                <tr key={order.id} className="bg-white hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4 font-mono text-xs font-black text-slate-700">{order.orderId || order.id}</td>
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-800 text-xs">{order.customer?.name || 'N/A'}</p>
                    <p className="text-slate-400 text-[11px] font-medium">{order.customer?.email}</p>
                  </td>
                  <td className="px-5 py-4 font-black text-slate-800 text-xs">₦{(order.amount || 0).toLocaleString()}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${STATUS_COLORS[order.trackingStatus || order.orderStatus] || 'bg-slate-100 text-slate-600'}`}>
                      {order.trackingStatus || order.orderStatus || 'Pending'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {order.confirmed ? (
                      <span className="inline-flex items-center gap-1 text-green-600 text-xs font-black">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Yes
                      </span>
                    ) : (
                      <span className="text-amber-500 text-xs font-bold">Pending</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-[11px] font-medium text-slate-500">{formatDate(order.createdAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-2">
                      {order.paymentStatus === 'Awaiting Payment Confirmation' && (
                        <button
                          onClick={() => handleConfirmPayment(order.id || order.orderId)}
                          disabled={isUpdating}
                          className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-600 font-black rounded-lg text-[10px] transition-all flex items-center justify-center gap-1 w-full"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Payment
                        </button>
                      )}
                      <button
                        onClick={() => { setSelectedOrder(order); setNewStatus(order.trackingStatus || ''); setTrackingId(order.trackingId || ''); }}
                        className="px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-600 font-black rounded-lg text-[10px] transition-all w-full"
                      >
                        Update Status
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400 font-bold">No orders found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Update Status Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-100 rounded-3xl p-6 w-full max-w-sm relative z-10 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-slate-800">Update Order Status</h3>
                <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs font-bold text-slate-500 mb-1">Order: <span className="text-slate-700 font-mono">{selectedOrder.orderId}</span></p>
              <p className="text-xs font-bold text-slate-500 mb-4">Customer: <span className="text-slate-700">{selectedOrder.customer?.name}</span></p>
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 mb-2">New Status</label>
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-cyan-400 appearance-none">
                  <option value="">Select a status</option>
                  {['Order Placed', ...ORDER_STATUSES].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="mb-5">
                <label className="block text-xs font-bold text-slate-500 mb-2">Manual Tracking Number (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. DHL-987654"
                  value={trackingId}
                  onChange={e => setTrackingId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-cyan-400"
                />
                <p className="text-[10px] text-slate-400 mt-1 font-semibold">Enter the tracking number once you book the courier.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={handleStatusUpdate} disabled={isUpdating || !newStatus}
                  className="flex-1 py-2.5 bg-cyan-400 hover:bg-cyan-500 disabled:bg-slate-200 text-white font-black rounded-xl text-sm transition-all active:scale-95">
                  {isUpdating ? 'Saving...' : 'Save Status'}
                </button>
                <button onClick={() => setSelectedOrder(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-sm transition-all">
                  Cancel
                </button>
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
      {/* Sidebar */}
      <div className="w-64 shrink-0 bg-slate-900 text-white flex flex-col fixed inset-y-0 left-0 z-30">
        {/* Brand */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-black text-white text-sm leading-tight">FezySlimes</p>
              <p className="text-slate-500 text-[11px] font-bold">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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
      <div className="ml-64 flex-1 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-100 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-slate-800 capitalize">{activeTab}</h1>
            <p className="text-xs font-medium text-slate-400">FezySlimes Admin Portal</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-100 rounded-full">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[11px] font-black text-green-600 uppercase tracking-wider">Admin Active</span>
            </div>
          </div>
        </header>

        {/* Tab Content */}
        <main className="flex-1 p-8">
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
