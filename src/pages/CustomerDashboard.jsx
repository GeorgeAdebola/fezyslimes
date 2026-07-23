import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../AuthContext';
import { Navigate, useNavigate, useOutletContext } from 'react-router-dom';
import { 
  User, 
  MapPin, 
  Package, 
  Heart, 
  Settings, 
  LogOut,
  Map,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Key,
  AlertTriangle,
  Lock,
  Sparkles,
  Eye,
  EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchProducts } from '../services/productService';
import { 
  getUserProfile, 
  updateUserProfile, 
  getWishlist, 
  updateWishlist, 
  getAddresses, 
  saveAddress, 
  deleteAddress, 
  setDefaultAddress 
} from '../services/dbService';
import { getMyOrders, ORDER_STATUSES } from '../services/orderService';
import { 
  EmailAuthProvider, 
  reauthenticateWithCredential, 
  updateEmail, 
  deleteUser, 
  updatePassword 
} from 'firebase/auth';
import { auth } from '../firebase';

export default function CustomerDashboard() {
  const { currentUser, logout, resetPassword } = useAuth();
  const navigate = useNavigate();
  const outletContext = useOutletContext();
  
  // Tab states
  const [activeTab, setActiveTab] = useState('profile');
  const [isInitializing, setIsInitializing] = useState(true);

  // Profile data states
  const [profile, setProfile] = useState({
    displayName: '',
    phoneNumber: '',
    notifications: { orderUpdates: true, promotions: false }
  });

  // Wishlist, Address & Order states
  const [wishlistIds, setWishlistIds] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [allProducts, setAllProducts] = useState([]);

  // Address form states
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressForm, setAddressForm] = useState({
    id: null,
    label: 'Home',
    fullName: '',
    phone: '',
    state: 'Lagos',
    city: '',
    address: '',
    landmark: '',
    isDefault: false
  });

  // Re-auth states (for sensitive operations like email change or deletion)
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthAction, setReauthAction] = useState(null); // 'email' or 'delete'

  // Settings states
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      const timer = setTimeout(() => setIsInitializing(false), 500);
      return () => clearTimeout(timer);
    }
    
    // Load initial user data
    const loadUserData = async () => {
      try {
        const [userProfile, userWishlist, userAddresses, fetchedProducts] = await Promise.all([
          getUserProfile(currentUser.uid),
          getWishlist(currentUser.uid),
          getAddresses(currentUser.uid),
          fetchProducts().catch(() => [])
        ]);

        setProfile(userProfile);
        setWishlistIds(userWishlist);
        setAddresses(userAddresses);
        setAllProducts(Array.isArray(fetchedProducts) ? fetchedProducts : []);
        setNewEmail(currentUser.email || '');

        // Load orders in background (server may not be running)
        if (currentUser.email) {
          setIsOrdersLoading(true);
          try {
            const userOrders = await getMyOrders(currentUser);
            setOrders(userOrders);
          } catch {
            // Server may be offline - silently fail
          } finally {
            setIsOrdersLoading(false);
          }
        }
      } catch (err) {
        console.error("Error loading dashboard data: ", err);
      } finally {
        setIsInitializing(false);
      }
    };

    loadUserData();
  }, [currentUser]);

  if (!currentUser) {
    if (isInitializing) return <div className="min-h-screen pt-32 pb-24 bg-slate-50 flex justify-center items-center">Loading Account...</div>;
    return <Navigate to="/" replace />;
  }

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Successfully logged out.');
      navigate('/');
    } catch (e) {
      toast.error('Failed to logout.');
    }
  };

  // --- PROFILE UPDATE HANDLERS ---
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await updateUserProfile(currentUser.uid, profile);
      toast.success('Profile details updated! ✨');
    } catch (err) {
      toast.error('Could not update profile details.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- RE-AUTHENTICATION FLOW ---
  const handleReauthenticate = async (e) => {
    e.preventDefault();
    if (!reauthPassword) return;

    try {
      const credential = EmailAuthProvider.credential(currentUser.email, reauthPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      setShowReauthModal(false);
      setReauthPassword('');
      toast.success('Authentication confirmed.');

      if (reauthAction === 'email') {
        await executeEmailChange();
      } else if (reauthAction === 'delete') {
        await executeAccountDeletion();
      }
    } catch (err) {
      console.error(err);
      toast.error('Incorrect password. Re-authentication failed.');
    }
  };

  const triggerEmailChange = () => {
    if (newEmail === currentUser.email) return;
    setReauthAction('email');
    setShowReauthModal(true);
  };

  const executeEmailChange = async () => {
    try {
      await updateEmail(auth.currentUser, newEmail);
      toast.success('Email address updated successfully! ✉️');
    } catch (err) {
      console.error(err);
      toast.error(err.message.replace('Firebase: ', ''));
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      toast.success('Password updated successfully! 🔐');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        setReauthAction('password');
        setShowReauthModal(true);
      } else {
        toast.error(err.message.replace('Firebase: ', ''));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    try {
      await resetPassword(currentUser.email);
      toast.success('Password recovery link sent to your inbox.');
    } catch (err) {
      toast.error('Failed to send recovery email.');
    }
  };

  const triggerAccountDeletion = () => {
    setReauthAction('delete');
    setShowReauthModal(true);
  };

  const executeAccountDeletion = async () => {
    if (!window.confirm("WARNING: This will permanently delete your account and all saved addresses/wishlists. Are you absolutely sure?")) return;
    try {
      await deleteUser(auth.currentUser);
      toast.success('Account successfully deactivated.');
      navigate('/');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete account.');
    }
  };

  // --- ADDRESS HANDLERS ---
  const handleSaveAddress = async (e) => {
    e.preventDefault();
    if (!addressForm.fullName || !addressForm.phone || !addressForm.city || !addressForm.address) {
      toast.error('Please fill in all required fields.');
      return;
    }

    try {
      await saveAddress(currentUser.uid, addressForm);
      toast.success(addressForm.id ? 'Address updated! 📍' : 'Address saved! 📍');
      setShowAddressForm(false);
      // Reload addresses
      const userAddresses = await getAddresses(currentUser.uid);
      setAddresses(userAddresses);
      // Reset form
      setAddressForm({
        id: null,
        label: 'Home',
        fullName: '',
        phone: '',
        state: 'Lagos',
        city: '',
        address: '',
        landmark: '',
        isDefault: false
      });
    } catch (err) {
      toast.error('Failed to save address details.');
    }
  };

  const handleEditAddress = (addr) => {
    setAddressForm(addr);
    setShowAddressForm(true);
  };

  const handleDeleteAddress = async (id) => {
    if (!window.confirm("Are you sure you want to delete this address?")) return;
    try {
      await deleteAddress(currentUser.uid, id);
      toast.success('Address removed.');
      const userAddresses = await getAddresses(currentUser.uid);
      setAddresses(userAddresses);
    } catch (err) {
      toast.error('Failed to delete address.');
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await setDefaultAddress(currentUser.uid, id);
      toast.success('Default address updated.');
      const userAddresses = await getAddresses(currentUser.uid);
      setAddresses(userAddresses);
    } catch (err) {
      toast.error('Failed to set default address.');
    }
  };

  // --- WISHLIST HANDLERS ---
  const handleRemoveWishlist = async (id) => {
    try {
      const updated = wishlistIds.filter(itemId => itemId !== id);
      await updateWishlist(currentUser.uid, updated);
      setWishlistIds(updated);
      toast.success('Item removed from wishlist.');
    } catch (err) {
      toast.error('Failed to update wishlist.');
    }
  };

  const handleMoveToCart = (product) => {
    if (outletContext?.handleAddToCart) {
      outletContext.handleAddToCart(product);
      handleRemoveWishlist(product.id);
      toast.success('Moved to cart! 🛒');
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile Details', icon: User },
    { id: 'orders', label: 'Order History', icon: Package },
    { id: 'addresses', label: 'Saved Addresses', icon: MapPin },
    { id: 'wishlist', label: 'Wishlist', icon: Heart },
    { id: 'tracking', label: 'Live Tracking', icon: Map },
    { id: 'settings', label: 'Account Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen pt-32 pb-24 bg-slate-50 relative z-10">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black text-slate-800">My Account</h1>
            <p className="text-slate-500 font-medium mt-2">
              Welcome back, <span className="text-cyan-600 font-bold">{profile.displayName || currentUser.email.split('@')[0]}</span>! <span className="inline-block align-middle leading-none select-none mx-0.5">🤍</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white/80 backdrop-blur-md border border-white shadow-xl shadow-pink-100/30 rounded-[2rem] p-6 space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${
                      activeTab === tab.id
                        ? 'bg-cyan-50 text-cyan-600 shadow-sm border border-cyan-100'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-cyan-500 border border-transparent'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                );
              })}

              <div className="pt-4 mt-4 border-t border-slate-100">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-red-500 hover:bg-red-50 transition-all border border-transparent"
                >
                  <LogOut className="w-5 h-5" />
                  Logout
                </button>
              </div>
            </div>
          </div>

          {/* Main Dashboard Panel */}
          <div className="lg:col-span-3">
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white/90 backdrop-blur-xl border border-white shadow-2xl shadow-pink-100/50 rounded-[2.5rem] p-8 min-h-[500px]"
            >
              
              {/* TAB 1: PROFILE DETAILS */}
              {activeTab === 'profile' && (
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <h2 className="text-2xl font-black text-slate-800">Profile Details</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
                      <input 
                        type="text" 
                        value={profile.displayName || ''} 
                        onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                        placeholder="John Doe" 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-medium focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phone Number</label>
                      <input 
                        type="tel" 
                        value={profile.phoneNumber || ''} 
                        onChange={(e) => setProfile({ ...profile, phoneNumber: e.target.value })}
                        placeholder="+234..." 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-medium focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Email Address (Registered)</label>
                    <input type="email" disabled value={currentUser.email || ''} className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-slate-500 font-medium cursor-not-allowed" />
                    <p className="text-[10px] text-slate-400 font-semibold">Change email under Account Settings</p>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className="px-6 py-3.5 bg-cyan-400 hover:bg-cyan-500 text-white font-black rounded-2xl shadow-md shadow-cyan-100 transition-all active:scale-95 text-sm"
                  >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </form>
              )}

              {/* TAB 2: ORDER HISTORY */}
              {activeTab === 'orders' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-black text-slate-800">Order History</h2>
                  
                  {isOrdersLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="w-8 h-8 border-4 border-slate-100 border-t-cyan-400 rounded-full animate-spin" />
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center p-12 bg-slate-50 border border-slate-100 rounded-[2rem] min-h-[300px]">
                      <Package className="w-12 h-12 text-slate-300 mb-4" />
                      <p className="text-slate-600 font-bold mb-2">No orders found.</p>
                      <p className="text-sm text-slate-400 font-medium">When you purchase slimes, they will appear here.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((order) => {
                        const statusIdx = ORDER_STATUSES.indexOf(order.trackingStatus);
                        const progress = statusIdx >= 0 ? Math.round((statusIdx / (ORDER_STATUSES.length - 1)) * 100) : 0;
                        const formatDate = (ts) => {
                          if (!ts) return 'N/A';
                          const d = ts.toDate ? ts.toDate() : new Date((ts.seconds || 0) * 1000);
                          return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
                        };
                        return (
                          <div key={order.id} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex flex-wrap gap-4 justify-between items-start mb-4">
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Order ID</p>
                                <p className="font-black text-slate-800 font-mono text-sm">{order.orderId}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount Paid</p>
                                <p className="font-black text-pink-500">₦{(order.amount || 0).toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</p>
                                <p className="font-bold text-slate-600 text-sm">{formatDate(order.createdAt)}</p>
                              </div>
                              <div>
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
                                  order.trackingStatus === 'Delivered' ? 'bg-green-50 text-green-600' :
                                  order.trackingStatus === 'Out for Delivery' ? 'bg-pink-50 text-pink-600' :
                                  order.trackingStatus === 'In Transit' ? 'bg-cyan-50 text-cyan-600' :
                                  'bg-amber-50 text-amber-600'
                                }`}>
                                  {order.trackingStatus || 'Processing'}
                                </span>
                              </div>
                            </div>

                            {/* Progress bar */}
                            {statusIdx >= 0 && (
                              <div className="mb-4">
                                <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1.5">
                                  <span>Order Placed</span>
                                  <span>{progress}% Complete</span>
                                  <span>Delivered</span>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-cyan-400 to-pink-400 rounded-full transition-all duration-700"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Items */}
                            {order.items && order.items.length > 0 && (
                              <div className="flex gap-2 flex-wrap mb-4">
                                {order.items.slice(0, 3).map((item, i) => (
                                  <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs">
                                    {item.image && <img src={item.image} alt={item.name} className="w-6 h-6 object-cover rounded-lg" />}
                                    <span className="font-bold text-slate-700 truncate max-w-[100px]">{item.name}</span>
                                    <span className="text-slate-400 font-semibold">×{item.quantity}</span>
                                  </div>
                                ))}
                                {order.items.length > 3 && (
                                  <span className="text-xs font-bold text-slate-400 self-center">+{order.items.length - 3} more</span>
                                )}
                              </div>
                            )}

                            <button
                              onClick={() => navigate(`/track-order?order=${order.orderId}`)}
                              className="w-full py-2.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-600 font-black rounded-xl text-xs transition-all flex items-center justify-center gap-2"
                            >
                              <Map className="w-4 h-4" /> Track This Order
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: SAVED ADDRESSES */}
              {activeTab === 'addresses' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                    <h2 className="text-2xl font-black text-slate-800">Saved Addresses</h2>
                    <button 
                      onClick={() => setShowAddressForm(!showAddressForm)}
                      className="px-4 py-2.5 bg-cyan-50 text-cyan-600 hover:bg-cyan-100 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
                    >
                      {showAddressForm ? 'Cancel' : <><Plus className="w-4 h-4" /> Add Address</>}
                    </button>
                  </div>

                  {/* Add / Edit Address Form */}
                  <AnimatePresence>
                    {showAddressForm && (
                      <motion.form 
                        initial={{ opacity: 0, height: 0 }} 
                        animate={{ opacity: 1, height: 'auto' }} 
                        exit={{ opacity: 0, height: 0 }}
                        onSubmit={handleSaveAddress}
                        className="bg-slate-50 border border-slate-100 rounded-3xl p-6 space-y-4 overflow-hidden"
                      >
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">Address Label</label>
                            <select 
                              value={addressForm.label}
                              onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium"
                            >
                              <option value="Home">Home</option>
                              <option value="Work">Work</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">Full Name</label>
                            <input 
                              type="text" 
                              required
                              value={addressForm.fullName}
                              onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium"
                              placeholder="Receiver's name"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">Phone Number</label>
                            <input 
                              type="tel" 
                              required
                              value={addressForm.phone}
                              onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium"
                              placeholder="0915..."
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">State</label>
                            <select 
                              value={addressForm.state}
                              onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium"
                            >
                              <option value="Lagos">Lagos</option>
                              <option value="Abuja">Abuja</option>
                              <option value="Oyo">Oyo</option>
                              <option value="Rivers">Rivers</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">City</label>
                            <input 
                              type="text" 
                              required
                              value={addressForm.city}
                              onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium"
                              placeholder="Ikeja"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">Landmark (Optional)</label>
                            <input 
                              type="text" 
                              value={addressForm.landmark}
                              onChange={(e) => setAddressForm({ ...addressForm, landmark: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium"
                              placeholder="Next to the big tree"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-400 mb-1">Delivery Address</label>
                          <textarea 
                            required
                            value={addressForm.address}
                            onChange={(e) => setAddressForm({ ...addressForm, address: e.target.value })}
                            rows={2}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium resize-none"
                            placeholder="123 Cocoa Avenue, Flat B"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id="isDefault" 
                            checked={addressForm.isDefault}
                            onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                          />
                          <label htmlFor="isDefault" className="text-xs font-bold text-slate-500 cursor-pointer">Set as default delivery address</label>
                        </div>

                        <button type="submit" className="px-5 py-2.5 bg-cyan-400 hover:bg-cyan-500 text-white font-black rounded-xl text-xs shadow-md">
                          Save Address
                        </button>
                      </motion.form>
                    )}
                  </AnimatePresence>

                  {/* List of Saved Addresses */}
                  {addresses.length === 0 ? (
                    <div className="text-center p-12 text-slate-400">
                      No addresses saved yet. Click Add Address to get started.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      {addresses.map((addr) => (
                        <div key={addr.id} className={`border rounded-3xl p-5 relative transition-all ${addr.isDefault ? 'border-cyan-400 bg-cyan-50/20 shadow-sm' : 'border-slate-200 bg-white hover:border-cyan-200'}`}>
                          {addr.isDefault && (
                            <span className="absolute top-4 right-4 bg-cyan-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Default
                            </span>
                          )}
                          <h4 className="font-black text-slate-800 text-sm mb-1">{addr.label}</h4>
                          <p className="text-slate-700 font-bold text-xs mb-2">{addr.fullName}</p>
                          <p className="text-slate-500 text-xs font-medium leading-relaxed mb-4">
                            {addr.address}, {addr.city}, {addr.state}
                            {addr.landmark && <span className="block text-[10px] text-slate-400 mt-1">Landmark: {addr.landmark}</span>}
                          </p>
                          <div className="flex gap-3 text-xs border-t border-slate-100 pt-3">
                            <button onClick={() => handleEditAddress(addr)} className="text-slate-500 hover:text-cyan-500 font-bold flex items-center gap-1">
                              <Edit2 className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button onClick={() => handleDeleteAddress(addr.id)} className="text-slate-500 hover:text-red-500 font-bold flex items-center gap-1">
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                            {!addr.isDefault && (
                              <button onClick={() => handleSetDefault(addr.id)} className="text-cyan-500 hover:text-cyan-600 font-black ml-auto">
                                Set Default
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: WISHLIST */}
              {activeTab === 'wishlist' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-black text-slate-800 border-b border-slate-100 pb-4">My Wishlist</h2>
                  
                  {wishlistIds.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center p-12 bg-slate-50 border border-slate-100 rounded-[2rem] min-h-[300px]">
                      <Heart className="w-12 h-12 text-slate-300 mb-4" />
                      <p className="text-slate-600 font-bold mb-2">Your wishlist is empty.</p>
                      <p className="text-sm text-slate-400 font-medium">Browse our slimes and add your favorites here!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {wishlistIds.map((id) => {
                        const product = allProducts.find(p => p.id === id);
                        if (!product) return null;
                        return (
                          <div key={product.id} className="flex gap-4 p-4 bg-white border border-slate-200 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                            <img src={product.image} alt={product.name} className="w-20 h-20 object-cover rounded-2xl shrink-0 border border-slate-100" />
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                              <div>
                                <h4 className="font-black text-slate-800 text-sm truncate">{product.name}</h4>
                                <p className="text-slate-400 text-xs font-semibold">{product.texture}</p>
                                <p className="font-black text-pink-500 text-sm mt-1">₦{product.price.toLocaleString()}</p>
                              </div>
                              
                              <div className="flex gap-2 pt-2 border-t border-slate-50 mt-2">
                                <button 
                                  onClick={() => handleMoveToCart(product)}
                                  className="px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-600 font-black rounded-xl text-[10px] uppercase tracking-wider flex-1"
                                >
                                  Move to Cart
                                </button>
                                <button 
                                  onClick={() => handleRemoveWishlist(product.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: LIVE TRACKING */}
              {activeTab === 'tracking' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-black text-slate-800">Live Tracking</h2>
                  <p className="text-slate-500 font-medium">Track an active order easily.</p>
                  <button 
                    onClick={() => navigate('/track-order')}
                    className="px-6 py-3.5 bg-pink-400 hover:bg-pink-500 text-white font-black rounded-2xl shadow-lg shadow-pink-200 transition-all active:scale-95 flex items-center gap-2"
                  >
                    <Map className="w-5 h-5" /> Open Tracking Portal
                  </button>
                </div>
              )}

              {/* TAB 6: ACCOUNT SETTINGS */}
              {activeTab === 'settings' && (
                <div className="space-y-8">
                  <h2 className="text-2xl font-black text-slate-800 border-b border-slate-100 pb-4">Account Settings</h2>
                  
                  {/* Change Email */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-black text-slate-700">Change Email Address</h3>
                    <div className="flex gap-4">
                      <input 
                        type="email" 
                        value={newEmail} 
                        onChange={(e) => setNewEmail(e.target.value)} 
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 font-medium" 
                      />
                      <button 
                        onClick={triggerEmailChange}
                        disabled={newEmail === currentUser.email}
                        className="px-4 py-2.5 bg-cyan-400 hover:bg-cyan-500 disabled:bg-slate-200 text-white font-black rounded-xl text-xs transition-all active:scale-95"
                      >
                        Update Email
                      </button>
                    </div>
                  </div>

                  {/* Change Password */}
                  <form onSubmit={handlePasswordChange} className="space-y-4 border-t border-slate-100 pt-6">
                    <h3 className="text-lg font-black text-slate-700">Change Password</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative">
                        <input 
                          type={showNewPassword ? "text" : "password"} 
                          placeholder="New Password" 
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 font-medium"
                          required
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="relative">
                        <input 
                          type={showConfirmPassword ? "text" : "password"} 
                          placeholder="Confirm New Password" 
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 font-medium"
                          required
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button type="submit" className="px-4 py-2.5 bg-cyan-400 hover:bg-cyan-500 text-white font-black rounded-xl text-xs transition-all active:scale-95">
                        Save Password
                      </button>
                      <button type="button" onClick={handlePasswordReset} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition-all">
                        Send Reset Email
                      </button>
                    </div>
                  </form>

                  {/* Notification Preferences */}
                  <div className="space-y-4 border-t border-slate-100 pt-6">
                    <h3 className="text-lg font-black text-slate-700">Notification Preferences</h3>
                    <div className="space-y-3 font-medium text-sm text-slate-600">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={profile.notifications?.orderUpdates}
                          onChange={(e) => setProfile({
                            ...profile,
                            notifications: { ...profile.notifications, orderUpdates: e.target.checked }
                          })}
                        />
                        <span>Send updates about my order status</span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={profile.notifications?.promotions}
                          onChange={(e) => setProfile({
                            ...profile,
                            notifications: { ...profile.notifications, promotions: e.target.checked }
                          })}
                        />
                        <span>Send newsletter, slime drops, and discounts</span>
                      </label>
                    </div>
                    <button onClick={handleUpdateProfile} className="px-4 py-2.5 bg-cyan-400 hover:bg-cyan-500 text-white font-black rounded-xl text-xs">
                      Save Preferences
                    </button>
                  </div>

                  {/* Deactivate Account */}
                  <div className="border-t border-red-100 pt-6 space-y-4">
                    <h3 className="text-lg font-black text-red-500 flex items-center gap-1.5"><AlertTriangle className="w-5 h-5"/> Danger Zone</h3>
                    <p className="text-xs font-semibold text-slate-500">Once deleted, your order history, saved wishlists, and delivery addresses will be permanently wiped.</p>
                    <button 
                      onClick={triggerAccountDeletion}
                      className="px-4 py-2.5 bg-red-100 hover:bg-red-200 text-red-600 font-black rounded-xl text-xs transition-all"
                    >
                      Delete Account
                    </button>
                  </div>

                </div>
              )}

            </motion.div>
          </div>

        </div>
      </div>

      {/* --- CONFIRMATION / RE-AUTHENTICATION MODAL --- */}
      <AnimatePresence>
        {showReauthModal && (
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowReauthModal(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" 
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-100 rounded-3xl p-6 w-full max-w-sm relative z-10 shadow-2xl"
            >
              <h3 className="text-lg font-black text-slate-800 mb-2 flex items-center gap-1.5">
                <Lock className="w-5 h-5 text-pink-500" /> Verify Identity
              </h3>
              <p className="text-slate-500 text-xs font-semibold mb-4">
                Please confirm your password to complete this action.
              </p>

              <form onSubmit={handleReauthenticate} className="space-y-4">
                <input 
                  type="password" 
                  placeholder="Enter Password" 
                  value={reauthPassword}
                  onChange={(e) => setReauthPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none"
                  required
                />
                <div className="flex gap-2">
                  <button type="submit" className="px-4 py-2 bg-pink-400 hover:bg-pink-500 text-white font-black rounded-xl text-xs w-full">
                    Confirm Password
                  </button>
                  <button type="button" onClick={() => setShowReauthModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs">
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
