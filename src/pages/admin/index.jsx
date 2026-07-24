import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Package, ShoppingBag, LogOut, Plus, Trash2, Edit2,
  X, Upload, CheckCircle2, AlertCircle, RefreshCw, Search, Filter,
  TrendingUp, Users, DollarSign, Clock, Shield, ChevronDown, Image as ImageIcon, Truck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ORDER_STATUSES } from '../../services/orderService';
import { storage } from '../../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
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
    texture: '', scent: '', stock: '', imageUrl: '', imageFile: null
  };
  const [form, setForm] = useState(emptyForm);
  const [imagePreview, setImagePreview] = useState('');

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/products`);
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Failed to load products.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadProducts(); }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setForm(prev => ({ ...prev, imageFile: file, imageUrl: '' }));
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
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
      imageUrl: product.image || '',
      imageFile: null
    });
    setImagePreview(product.image || '');
    setShowForm(true);
  };

  const openNewForm = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setImagePreview('');
    setShowForm(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setUploadProgress(null);

    try {
      // ---- Step 1: Upload image to Firebase Storage if a file was selected ----
      let finalImageUrl = form.imageUrl;
      if (form.imageFile) {
        toast.loading('Authenticating upload...', { id: 'img-upload' });
        
        // Ensure the client is authenticated with Firebase so Storage Rules don't block us
        const auth = getAuth();
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }

        toast.loading('Uploading image to Firebase Storage...', { id: 'img-upload' });
        const storageRef = ref(storage, `product-images/${Date.now()}-${form.imageFile.name.replace(/\s+/g, '_')}`);
        const uploadTask = uploadBytesResumable(storageRef, form.imageFile);

        finalImageUrl = await new Promise((resolve, reject) => {
          // Add a safety timeout so it never hangs indefinitely
          const timeout = setTimeout(() => {
            reject(new Error("Upload timed out after 30 seconds. Please check your network or Firebase config."));
          }, 30000);

          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              setUploadProgress(pct);
            },
            (err) => {
              clearTimeout(timeout);
              console.error('[Firebase Storage Error]', err);
              reject(err);
            },
            async () => {
              clearTimeout(timeout);
              try {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(url);
              } catch (urlErr) {
                console.error('[Firebase URL Error]', urlErr);
                reject(urlErr);
              }
            }
          );
        });
        toast.dismiss('img-upload');
        setUploadProgress(null);
      }

      // ---- Step 2: Send product data (with Firebase Storage URL) to backend ----
      const payload = {
        name: form.name,
        description: form.description,
        price: form.price,
        category: form.category,
        texture: form.texture,
        scent: form.scent,
        stock: form.stock,
        image: finalImageUrl || ''
      };

      const url = editingProduct
        ? `/api/admin/products/${editingProduct.id}`
        : '/api/admin/products';
      const method = editingProduct ? 'PUT' : 'POST';

      console.log(`[Frontend] Sending ${method} request to backend at ${url}`);
      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 15000); // 15-second timeout for backend
      
      const data = await res.json();
      if (!res.ok) {
        console.error('[Frontend] Backend returned error:', data);
        throw new Error(data.error || 'Failed to save product.');
      }
      console.log('[Frontend] Backend successfully processed product:', data);

      toast.success(editingProduct ? 'Product updated! ✨' : 'Product created! 🎉');
      setShowForm(false);
      await loadProducts();
    } catch (err) {
      toast.dismiss('img-upload');
      toast.error(err.message);
    } finally {
      setIsSaving(false);
      setUploadProgress(null);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      const res = await authFetch(`/api/admin/products/${productId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete product.');
      toast.success('Product deleted.');
      await loadProducts();
    } catch (err) {
      toast.error(err.message);
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

              {/* Image upload — Firebase Storage */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">
                  Product Image
                  <span className="ml-2 text-cyan-500 font-normal normal-case">Uploaded to Firebase Storage</span>
                </label>
                <div className="flex gap-4 items-start">
                  {imagePreview && (
                    <img src={imagePreview} alt="Preview" className="w-24 h-24 object-cover rounded-2xl border border-slate-200 shrink-0" />
                  )}
                  <div className="flex-1 space-y-2">
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-cyan-400 rounded-xl text-xs font-bold text-slate-600 transition-all">
                      <Upload className="w-4 h-4" /> Upload Image File
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

                    {/* Upload progress bar */}
                    {uploadProgress !== null && (
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-cyan-400 h-2 rounded-full transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                        <p className="text-[10px] text-slate-400 mt-1">{uploadProgress}% uploaded to Firebase Storage</p>
                      </div>
                    )}

                    <p className="text-[10px] text-slate-400 font-semibold">— or paste an image URL —</p>
                    <input type="url" placeholder="https://..." value={form.imageUrl}
                      onChange={e => { setForm({...form, imageUrl: e.target.value, imageFile: null}); setImagePreview(e.target.value); }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-cyan-400" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={isSaving}
                  className="px-5 py-2.5 bg-cyan-400 hover:bg-cyan-500 disabled:bg-slate-300 text-white font-black rounded-xl text-sm transition-all active:scale-95">
                  {isSaving ? (uploadProgress !== null ? `Uploading ${uploadProgress}%...` : 'Saving...') : (editingProduct ? 'Update Product' : 'Create Product')}
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
                {product.image ? (
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
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
        const aTime = a.createdAt?.toMillis?.() || new Date(a.createdAt?.seconds * 1000 || 0).getTime();
        const bTime = b.createdAt?.toMillis?.() || new Date(b.createdAt?.seconds * 1000 || 0).getTime();
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

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const dateObj = timestamp.toDate ? timestamp.toDate() : new Date((timestamp.seconds || 0) * 1000);
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
                    <button
                      onClick={() => { setSelectedOrder(order); setNewStatus(order.trackingStatus || ''); setTrackingId(order.trackingId || ''); }}
                      className="px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-600 font-black rounded-lg text-[10px] transition-all"
                    >
                      Update Status
                    </button>
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
  const [rates, setRates] = useState({
    "Lagos-Uber": 3000,
    "Lagos-Gokada": 2500,
    "Ogun-DHL": 3500,
    "Oyo-DHL": 3500,
    "Abuja-DHL": 5000,
    "PH-DHL": 4500
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadRates = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/shipping-rates`);
        if (res.ok) {
          const data = await res.json();
          setRates(prev => ({ ...prev, ...data }));
        }
      } catch (err) {
        toast.error('Failed to load shipping rates.');
      } finally {
        setIsLoading(false);
      }
    };
    loadRates();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await authFetch('/api/admin/shipping-rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rates)
      });
      if (!res.ok) throw new Error('Failed to update shipping rates.');
      toast.success('Shipping rates updated successfully! 🚚');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRateChange = (key, value) => {
    const numericVal = value === '' ? 0 : parseInt(value, 10);
    setRates(prev => ({
      ...prev,
      [key]: isNaN(numericVal) ? 0 : numericVal
    }));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" />
      </div>
    );
  }

  const rateKeys = [
    { key: 'Lagos-Uber', label: 'Lagos (Uber Courier)' },
    { key: 'Lagos-Gokada', label: 'Lagos (Gokada Bike)' },
    { key: 'Ogun-DHL', label: 'Ogun State (DHL)' },
    { key: 'Oyo-DHL', label: 'Oyo State (DHL)' },
    { key: 'Abuja-DHL', label: 'Abuja FCT (DHL)' },
    { key: 'PH-DHL', label: 'Port Harcourt / Rivers State (DHL)' }
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-black text-slate-800">Shipping & Delivery Rates</h2>
        <p className="text-slate-500 text-sm font-medium">Configure flat-rate fees for delivery zones and couriers</p>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
        <div className="space-y-4">
          {rateKeys.map(({ key, label }) => (
            <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
              <label className="text-sm font-bold text-slate-600">{label}</label>
              <div className="relative max-w-[200px] w-full">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₦</span>
                <input
                  type="number"
                  min="0"
                  required
                  value={rates[key] ?? ''}
                  onChange={(e) => handleRateChange(key, e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-800 focus:outline-none focus:border-cyan-400 transition-colors"
                />
              </div>
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-3.5 bg-cyan-400 hover:bg-cyan-500 disabled:bg-slate-200 text-white font-black rounded-2xl shadow-lg shadow-cyan-200 transition-all active:scale-95 text-base flex items-center justify-center gap-2"
        >
          {isSaving ? 'Saving Rates...' : 'Save Shipping Rates'}
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
          </motion.div>
        </main>
      </div>
    </div>
  );
}
