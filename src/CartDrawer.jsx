import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Plus, Minus, ArrowRight, CheckCircle2, CreditCard, ShieldCheck, ArrowLeft, Map } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { shippingLocations } from './data';
import { createOrder } from './services/orderService';
import { useAuth } from './AuthContext';
import { getAddresses } from './services/dbService';

const STEPS = ['Cart', 'Details', 'Shipping', 'Payment'];

export default function CartDrawer({ isOpen, onClose, cartItems, onUpdateQuantity, onRemoveItem, onClearCart }) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(0); // 0: Cart, 1: Details, 2: Shipping, 3: Payment, 4: Success
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedState, setSelectedState] = useState(shippingLocations[0].name);
  const [city, setCity] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [notes, setNotes] = useState('');
  const [shippingMethod, setShippingMethod] = useState('standard');
  
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState('');
  const [createdTracking, setCreatedTracking] = useState('');

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
          setSelectedState(defaultAddr.state || shippingLocations[0].name);
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

  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const activeShipping = shippingLocations.find(loc => loc.name === selectedState);
  const baseShippingCost = activeShipping ? activeShipping.price : 0;
  const shippingCost = shippingMethod === 'express' ? baseShippingCost + 1500 : baseShippingCost;
  const total = subtotal + shippingCost;

  const handleClose = () => {
    if (currentStep === 4) setCurrentStep(0);
    onClose();
  };

  const handleNext = () => setCurrentStep(prev => Math.min(prev + 1, 3));
  const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  const isDetailsValid = fullName.trim() !== '' && email.trim() !== '' && phone.trim() !== '';
  const isShippingValid = selectedState.trim() !== '' && city.trim() !== '' && streetAddress.trim() !== '';
  
  const isPaymentAllowed = isDetailsValid && isShippingValid && shippingMethod && cartItems.length > 0;

  const handleCheckoutSubmit = (e) => {
    e.preventDefault();
    if (!isPaymentAllowed) return;

    setIsProcessingPayment(true);
    
    // Ensure Paystack library is loaded
    if (!window.PaystackPop) {
      toast.error('Payment gateway is still loading. Please wait a moment.');
      setIsProcessingPayment(false);
      return;
    }

    const paystackPublicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
    if (!paystackPublicKey) {
      toast.error('Paystack Public Key is missing. Please configure it in your environment.');
      setIsProcessingPayment(false);
      return;
    }

    // Force check live mode key constraint if desired
    if (paystackPublicKey.startsWith('pk_test')) {
      console.warn("Using Paystack Test Key. Ensure this is replaced with Live Public Key in production.");
    }

    try {
      const paystack = new window.PaystackPop();
      paystack.newTransaction({
        key: paystackPublicKey,
        email: email,
        amount: total * 100, // amount in kobo
        currency: 'NGN',
        firstName: fullName.split(' ')[0] || '',
        lastName: fullName.split(' ')[1] || '',
        phone: phone,
        metadata: {
          custom_fields: [
            {
              display_name: "Customer Name",
              variable_name: "customer_name",
              value: fullName
            },
            {
              display_name: "Phone Number",
              variable_name: "phone_number",
              value: phone
            }
          ]
        },
        onSuccess: async (transaction) => {
          try {
            const response = await fetch('http://localhost:5000/api/verify-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                reference: transaction.reference,
                customerName: fullName,
                email,
                phone,
                address: `${streetAddress}, ${city}, ${selectedState}`,
                landmark,
                notes,
                total,
                items: cartItems
              })
            });

            const responseData = await response.json();
            
            if (!response.ok) {
              throw new Error(responseData.error || 'Payment verification failed.');
            }
            
            setCreatedOrderId(responseData.orderId);
            setCreatedTracking(responseData.trackingId);
            setIsProcessingPayment(false);
            toast.success('Payment Verified! Order Confirmed ✨');
            setCurrentStep(4);
            onClearCart();
          } catch (error) {
            console.error("Order creation failed: ", error);
            setIsProcessingPayment(false);
            toast.error(error.message || 'Payment completed but verification failed.');
          }
        },
        onCancel: () => {
          setIsProcessingPayment(false);
          toast.error('Payment cancelled.');
        }
      });
    } catch (err) {
      console.error("Paystack transaction initialization failed: ", err);
      setIsProcessingPayment(false);
      toast.error('Could not initialize Paystack popup.');
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
                    <div>
                      <h3 className="text-xl font-black text-slate-800 border-b border-slate-100 pb-2 mb-4">Shipping Address <span className="text-red-400">*</span></h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">State</label>
                          <select required value={selectedState} onChange={(e) => setSelectedState(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none font-medium transition-all appearance-none">
                            {shippingLocations.map((loc) => (
                              <option key={loc.name} value={loc.name}>{loc.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">City</label>
                          <input type="text" required value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ikeja" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none font-medium transition-all" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Delivery Address</label>
                          <textarea required value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} placeholder="123 Slime Street, Apartment 4B" rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none font-medium transition-all resize-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Landmark (Optional)</label>
                          <input type="text" value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Next to the big mall" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:border-cyan-400 outline-none font-medium transition-all" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl font-black text-slate-800 border-b border-slate-100 pb-2 mb-4">Shipping Method <span className="text-red-400">*</span></h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div onClick={() => setShippingMethod('standard')} className={`border rounded-2xl p-4 cursor-pointer transition-all ${shippingMethod === 'standard' ? 'border-cyan-400 bg-cyan-50' : 'border-slate-200 hover:border-cyan-200'}`}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-slate-800 text-sm">Standard</span>
                            {shippingMethod === 'standard' && <CheckCircle2 className="w-4 h-4 text-cyan-500" />}
                          </div>
                          <p className="text-xs text-slate-500 font-medium">3-5 Business Days</p>
                        </div>
                        <div onClick={() => setShippingMethod('express')} className={`border rounded-2xl p-4 cursor-pointer transition-all ${shippingMethod === 'express' ? 'border-cyan-400 bg-cyan-50' : 'border-slate-200 hover:border-cyan-200'}`}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-slate-800 text-sm">Express</span>
                            {shippingMethod === 'express' && <CheckCircle2 className="w-4 h-4 text-cyan-500" />}
                          </div>
                          <p className="text-xs text-slate-500 font-medium">+₦1,500 (Next Day)</p>
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
                          <span>Shipping Fee ({shippingMethod})</span>
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
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                        <div className="flex items-center gap-2 text-sm font-black text-slate-800">
                          <ShieldCheck className="w-5 h-5 text-cyan-500" /> Secure payment powered by Paystack
                        </div>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed">
                          Your payment is encrypted and processed securely through Paystack. We do not store your card or bank details.
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest pt-3 border-t border-slate-100">
                          <span>Visa</span> • <span>Mastercard</span> • <span>Verve</span> • <span>Transfer</span> • <span>USSD</span>
                        </div>
                      </div>
                      {!window.PaystackPop && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col gap-2 text-left">
                          <p className="text-xs font-bold text-amber-700 leading-relaxed">
                            ⚠️ Payment gateway script is taking longer than expected to load.
                          </p>
                          <button 
                            type="button"
                            onClick={() => window.location.reload()}
                            className="text-xs text-amber-950 font-black underline hover:text-amber-800 text-left w-fit"
                          >
                            Click here to refresh the page
                          </button>
                        </div>
                      )}
                      <button 
                        type="submit" 
                        disabled={isProcessingPayment || !isPaymentAllowed || !window.PaystackPop} 
                        className="w-full py-4 bg-cyan-400 hover:bg-cyan-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black rounded-2xl shadow-lg shadow-cyan-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                      >
                        {isProcessingPayment ? (
                          <span className="flex items-center gap-2">Connecting to Paystack...</span>
                        ) : (
                          <><CreditCard className="w-5 h-5" /> Pay Now ₦{total.toLocaleString()}</>
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
                        <span className="text-slate-500 font-bold">Estimated Delivery:</span>
                        <span className="text-cyan-600 font-black">
                          {shippingMethod === 'express' ? 'Next Day' : '3-5 Business Days'}
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
                <button onClick={handleNext} className="w-full py-4 bg-cyan-400 hover:bg-cyan-500 text-white font-black rounded-2xl shadow-lg shadow-cyan-200 transition-all active:scale-95 flex items-center justify-center gap-2 text-base">
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
