import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Plus, Minus, ArrowRight, CheckCircle2, CreditCard, ShieldCheck, ArrowLeft, Map } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { shippingLocations } from './data';
import { createOrder } from './services/orderService';
import { useAuth } from './AuthContext';
import { getAddresses } from './services/dbService';
import { API_BASE } from './services/productService';

const STEPS = ['Cart', 'Details', 'Shipping', 'Payment'];

export default function CartDrawer({ isOpen, onClose, cartItems, onUpdateQuantity, onRemoveItem, onClearCart, onAddToCart, activatorProduct }) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(0); // 0: Cart, 1: Details, 2: Shipping, 3: Payment, 4: Success
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedState, setSelectedState] = useState('Lagos');
  const [city, setCity] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedCourier, setSelectedCourier] = useState('Uber');
  const [rates, setRates] = useState([]);
  const [selectedZoneKey, setSelectedZoneKey] = useState('');
  
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState('');
  const [createdTracking, setCreatedTracking] = useState('');
  
  const [bankDetails, setBankDetails] = useState({ bankName: '', accountName: '', accountNumber: '' });

  // Fetch active shipping rates (now an array of zone objects) & bank details
  useEffect(() => {
    if (!isOpen) return;
    const fetchRates = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/shipping-rates`);
        if (response.ok) {
          const data = await response.json();
          // API now returns an array of zone objects
          setRates(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Error fetching shipping rates:", err);
      }
      
      try {
        const bankRes = await fetch(`${API_BASE}/api/bank-details`);
        if (bankRes.ok) {
          setBankDetails(await bankRes.json());
        }
      } catch (err) {
        console.error("Error fetching bank details:", err);
      }
    };
    fetchRates();
  }, [isOpen]);

  // Auto pre-fill default address
  useEffect(() => {
    if (!currentUser || !isOpen) return;

    const prefillDefaultAddress = async () => {
      try {
        const addrList = await getAddresses(currentUser.uid);
        const defaultAddr = addrList.find(addr => addr.isDefault);
        if (defaultAddr) {
          setFullName(defaultAddr.fullName || '');
          setPhone(defaultAddr.phone || '');
          setSelectedState(defaultAddr.state || 'Lagos');
          setCity(defaultAddr.city || '');
          setStreetAddress(defaultAddr.address || '');
          setLandmark(defaultAddr.landmark || '');
        }
        if (currentUser.email) {
          setEmail(currentUser.email);
        }
      } catch (err) {
        console.error("Error prefilling default address: ", err);
      }
    };

    prefillDefaultAddress();
  }, [currentUser, isOpen]);

  const isStateSupported = selectedZoneKey !== '' && selectedZoneKey !== 'Other';

  // Derive the selected zone object for easy access
  const selectedZoneObj = isStateSupported ? (Array.isArray(rates) ? rates : []).find(z => z.key === selectedZoneKey) : null;

  const getDeliveryFee = () => {
    if (!isStateSupported) return 0;
    const match = (Array.isArray(rates) ? rates : []).find(z => z.key === selectedZoneKey);
    return match ? match.rate : 0;
  };

  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const shippingCost = getDeliveryFee();
  const total = subtotal + shippingCost;

  const slimeItems = cartItems.filter(item => item.id !== 'slime-activator');
  const numSlimes = slimeItems.reduce((acc, item) => acc + item.quantity, 0);
  const hasActivator = cartItems.some(item => item.id === 'slime-activator');
  const canProceedToCheckout = numSlimes >= 4 || hasActivator;

  const handleClose = () => {
    if (currentStep === 4) setCurrentStep(0);
    onClose();
  };

  const handleNext = () => {
    if (currentStep === 0 && !canProceedToCheckout) {
      toast.error('Please add a Slime Activator to continue.');
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };
  const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  const isDetailsValid = fullName.trim() !== '' && email.trim() !== '' && phone.trim() !== '';
  // Must have a zone selected, city, and street address
  const isShippingValid = isStateSupported && selectedZoneKey !== '' && city.trim() !== '' && streetAddress.trim() !== '';
  
  const isPaymentAllowed = isDetailsValid && isShippingValid && cartItems.length > 0;

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (!isPaymentAllowed) return;

    setIsProcessingPayment(true);
    
    try {
      const response = await fetch(`${API_BASE}/api/place-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerName: fullName,
          email,
          phone,
          address: `${streetAddress}, ${city}, ${selectedState}`,
          landmark,
          notes,
          total,
          items: cartItems,
          selectedZone: selectedZoneObj?.label || selectedState,
          selectedCourier: selectedZoneObj?.courier || selectedCourier || 'DHL',
          deliveryFee: shippingCost
        })
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to place order.');
      }
      
      setCreatedOrderId(responseData.orderId);
      // For bank transfer, trackingId might be null initially
      setIsProcessingPayment(false);
      toast.success('Order Placed Successfully! ✨');
      setCurrentStep(4);
      onClearCart();
    } catch (error) {
      console.error("Order creation failed: ", error);
      setIsProcessingPayment(false);
      toast.error(error.message || 'Failed to submit order.');
    }
  };

  const ProgressIndicator = () => (
    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center relative">
      <div className="absolute left-6 right-6 top-1/2 h-0.5 bg-slate-200 -z-10" />
      {STEPS.map((stepLabel, idx) => (
        <div key={stepLabel} className="flex flex-col items-center gap-1 z-10 bg-slate-50/50 px-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-colors ${
            currentStep > idx ? 'bg-cyan-400 text-white' : 
            currentStep === idx ? 'bg-cyan-500 text-white ring-4 ring-cyan-100' : 'bg-slate-200 text-slate-500'
          }`}>
            {currentStep > idx ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
          </div>
          <span className={`text-[10px] font-bold ${currentStep >= idx ? 'text-slate-800' : 'text-slate-400'}`}>
            {stepLabel}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleClose} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />

          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative w-full max-w-lg bg-white/95 backdrop-blur-xl border-l border-white shadow-2xl flex flex-col h-full z-10 overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md relative z-20">
              <div className="flex items-center gap-3">
                {currentStep > 0 && currentStep < 4 && (
                  <button onClick={handleBack} className="p-2 -ml-2 text-slate-400 hover:text-cyan-500 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <span className="text-xl font-black text-slate-800">Checkout</span>
              </div>
              <button onClick={handleClose} className="p-2 text-slate-400 hover:text-pink-500 hover:bg-pink-50 rounded-xl transition-all shadow-sm border border-transparent hover:border-pink-100">
                <X className="w-6 h-6" />
              </button>
            </div>

            {currentStep < 4 && <ProgressIndicator />}

            <div className="flex-1 overflow-y-auto relative">
              <AnimatePresence mode="wait">
                
                {/* STEP 0: CART */}
                {currentStep === 0 && (
                  <motion.div key="step-0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-6 space-y-4">
                    {!canProceedToCheckout && cartItems.length > 0 && (
                      <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-inner mb-2">
                        <div className="flex items-center gap-3 text-pink-500 font-bold text-sm">
                          <span className="text-xl">⚠️</span>
                          <p>Add a slime activator to complete your order.</p>
                        </div>
                        <button 
                          onClick={() => onAddToCart({
                            id: 'slime-activator',
                            name: activatorProduct?.name || 'Slime Activator',
                            price: activatorProduct?.price ?? 4000,
                            category: activatorProduct?.category || 'care',
                            image: activatorProduct?.image || '/logo.png'
                          })}
                          className="px-4 py-2 bg-pink-400 hover:bg-pink-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md whitespace-nowrap active:scale-95 transition-all"
                        >
                          Add Activator
                        </button>
                      </div>
                    )}
                    
                    {cartItems.length === 0 ? (
                      <div className="flex flex-col items-center justify-center text-center text-slate-500 h-64">
                        <div className="w-20 h-20 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4 shadow-inner">
                          <Trash2 className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="text-base font-bold text-slate-600">Your cart is empty</p>
                      </div>
                    ) : (
                      cartItems.map((item) => (
                        <div key={item.id} className="flex gap-4 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm transition-all">
                          <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded-xl shrink-0 border border-slate-100" />
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-1">
                              <h4 className="font-black text-slate-800 text-base truncate pr-2">{item.name}</h4>
                              <button onClick={() => onRemoveItem(item.id)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg p-1.5 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="flex justify-between items-center">
                              <div className="flex items-center border border-slate-200 bg-slate-50 rounded-xl overflow-hidden">
                                <button onClick={() => onUpdateQuantity(item.id, item.quantity - 1)} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200"><Minus className="w-3 h-3" /></button>
                                <span className="px-3 text-sm font-black text-slate-800">{item.quantity}</span>
                                <button onClick={() => onUpdateQuantity(item.id, item.quantity + 1)} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200"><Plus className="w-3 h-3" /></button>
                              </div>
                              <span className="font-black text-pink-500 text-base">₦{(item.price * item.quantity).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}

                {/* STEP 1: DETAILS */}
                {currentStep === 1 && (
                  <motion.div key="step-1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-6 space-y-6">
                    <h3 className="text-xl font-black text-slate-800 border-b border-slate-100 pb-2">Customer Information <span className="text-red-400">*</span></h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
                        <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Tire & Tase" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none font-medium transition-all" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@fezyslimes.com" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none font-medium transition-all" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone Number</label>
                        <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09155577753" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none font-medium transition-all" />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* STEP 2: SHIPPING */}
                {currentStep === 2 && (
                  <motion.div key="step-2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-6 space-y-8">

                    {/* Delivery Zone Picker */}
                    <div>
                      <h3 className="text-xl font-black text-slate-800 border-b border-slate-100 pb-2 mb-4">Select Delivery Zone <span className="text-red-400">*</span></h3>
                      {rates.length === 0 ? (
                        <p className="text-xs text-slate-400 font-semibold">Loading delivery zones…</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          {rates.map(zone => {
                            const isSelected = selectedZoneKey === zone.key;
                            return (
                              <button
                                type="button"
                                key={zone.key}
                                onClick={() => {
                                  setSelectedZoneKey(zone.key);
                                  setSelectedState(zone.state);
                                  setSelectedCourier(zone.courier || 'DHL');
                                }}
                                className={`text-left border rounded-2xl p-4 transition-all cursor-pointer ${
                                  isSelected
                                    ? 'border-cyan-400 bg-cyan-50 shadow-md shadow-cyan-100'
                                    : 'border-slate-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/40'
                                }`}
                              >
                                <div className="flex justify-between items-start mb-1">
                                  <span className={`font-bold text-sm leading-tight ${isSelected ? 'text-cyan-700' : 'text-slate-800'}`}>
                                    {zone.label}
                                  </span>
                                  {isSelected && <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />}
                                </div>
                                <p className={`text-xs font-semibold ${isSelected ? 'text-cyan-600' : 'text-slate-500'}`}>
                                  ₦{(zone.rate || 0).toLocaleString()} • {zone.courier}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {!selectedZoneKey && (
                        <p className="text-xs text-amber-600 font-bold mt-3">⚠ Please select a delivery zone to continue.</p>
                      )}
                    </div>

                    {/* Address Fields */}
                    <div>
                      <h3 className="text-xl font-black text-slate-800 border-b border-slate-100 pb-2 mb-4">Delivery Address <span className="text-red-400">*</span></h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">City / Area</label>
                          <input type="text" required value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Lekki" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none font-medium transition-all" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Street Address</label>
                          <textarea required value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} placeholder="123 Slime Street, Apartment 4B" rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none font-medium transition-all resize-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Landmark (Optional)</label>
                          <input type="text" value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Next to the big mall" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:border-cyan-400 outline-none font-medium transition-all" />
                        </div>
                      </div>
                    </div>

                  </motion.div>
                )}

                {/* STEP 3: PAYMENT */}
                {currentStep === 3 && (
                  <motion.form key="step-3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handleCheckoutSubmit} className="p-6 space-y-8">
                    
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6">
                      <h3 className="text-lg font-black text-slate-800 border-b border-slate-200 pb-2 mb-4">Order Summary</h3>
                      <div className="space-y-3 text-sm text-slate-600 font-medium">
                        <div className="flex justify-between">
                          <span>Items Total</span>
                          <span className="font-bold text-slate-800">₦{subtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Shipping ({selectedZoneObj?.label || selectedZoneObj?.courier || selectedCourier})</span>
                          <span className="font-bold text-slate-800">₦{shippingCost.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-4 text-lg">
                          <span className="font-black text-slate-800">Total Amount</span>
                          <span className="font-black text-pink-500">₦{total.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes to Seller (Optional)</label>
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Gift message or instructions" rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:border-cyan-400 outline-none font-medium transition-all resize-none" />
                    </div>

                    <div className="pt-4 flex flex-col gap-4">
                      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 text-sm font-black text-slate-800 border-b border-slate-100 pb-3">
                          <CreditCard className="w-5 h-5 text-cyan-500" /> Manual Bank Transfer
                        </div>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed">
                          Please transfer the exact amount of <strong>₦{total.toLocaleString()}</strong> to the account below, then click "I've Made Payment". Your order will be confirmed once payment is received.
                        </p>
                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Bank Name</span>
                            <span className="text-sm font-black text-slate-800">{bankDetails.bankName || 'Loading...'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Account Number</span>
                            <span className="text-sm font-black text-pink-500 tracking-wider">{bankDetails.accountNumber || 'Loading...'}</span>
                          </div>
                          <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Account Name</span>
                            <span className="text-sm font-black text-slate-800">{bankDetails.accountName || 'Loading...'}</span>
                          </div>
                        </div>
                      </div>

                      <button 
                        type="submit" 
                        disabled={isProcessingPayment || !isPaymentAllowed} 
                        className="w-full py-4 bg-cyan-400 hover:bg-cyan-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black rounded-2xl shadow-lg shadow-cyan-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                      >
                        {isProcessingPayment ? (
                          <span className="flex items-center gap-2">Processing Order...</span>
                        ) : (
                          <><CheckCircle2 className="w-5 h-5" /> I've Made Payment</>
                        )}
                      </button>
                    </div>

                  </motion.form>
                )}

                {/* STEP 4: SUCCESS */}
                {currentStep === 4 && (
                  <motion.div key="step-4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center p-8 text-center space-y-6 h-full mt-6">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-100 to-cyan-100 border-4 border-white shadow-xl flex items-center justify-center text-cyan-500">
                      <CheckCircle2 className="w-10 h-10 animate-bounce drop-shadow-md" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-800 mb-1">Payment Successful ✅</h3>
                      <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed font-medium">
                        Thank you for your purchase! Your order is now registered and preparing.
                      </p>
                    </div>
                    
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 w-full text-left font-sans text-sm space-y-3 shadow-inner">
                      <div className="flex justify-between border-b border-slate-200 pb-2">
                        <span className="text-slate-500 font-bold">Order Number:</span>
                        <span className="text-pink-500 font-black">{createdOrderId}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200 pb-2">
                        <span className="text-slate-500 font-bold">Customer Name:</span>
                        <span className="text-slate-800 font-bold">{fullName}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200 pb-2">
                        <span className="text-slate-500 font-bold">Amount Paid:</span>
                        <span className="text-slate-800 font-black">₦{total.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-bold">Delivery Zone:</span>
                        <span className="text-cyan-600 font-black">
                          {selectedZoneObj?.label || selectedState}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 w-full">
                      <button 
                        onClick={() => { 
                          handleClose(); 
                          navigate(`/track-order?order=${createdOrderId}`); 
                        }} 
                        className="px-6 py-3.5 w-full bg-pink-400 hover:bg-pink-500 text-white font-black rounded-2xl shadow-lg shadow-pink-200 transition-all active:scale-95 text-base flex items-center justify-center gap-2"
                      >
                        <Map className="w-5 h-5" /> Track Order
                      </button>
                      <button onClick={handleClose} className="px-6 py-3.5 w-full bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 font-black rounded-2xl shadow-sm transition-all active:scale-95 text-sm">
                        Continue Shopping
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom Footer Actions (Next buttons for non-payment steps) */}
            {currentStep < 3 && currentStep > 0 && (
              <div className="p-6 border-t border-slate-100 bg-white/80 backdrop-blur-md relative z-20">
                <button 
                  onClick={handleNext}
                  disabled={(currentStep === 1 && !isDetailsValid) || (currentStep === 2 && !isShippingValid)}
                  className="w-full py-4 bg-cyan-400 hover:bg-cyan-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black rounded-2xl shadow-lg shadow-cyan-200 transition-all active:scale-95 flex items-center justify-center gap-2 text-base"
                >
                  Continue <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}
            
            {currentStep === 0 && cartItems.length > 0 && (
              <div className="p-6 border-t border-slate-100 bg-white/80 backdrop-blur-md relative z-20 space-y-4">
                <div className="flex justify-between text-base font-medium text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-black text-slate-800">₦{subtotal.toLocaleString()}</span>
                </div>
                <button 
                  onClick={handleNext} 
                  disabled={!canProceedToCheckout}
                  className="w-full py-4 bg-cyan-400 hover:bg-cyan-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black rounded-2xl shadow-lg shadow-cyan-200 transition-all active:scale-95 flex items-center justify-center gap-2 text-base"
                >
                  Proceed <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
