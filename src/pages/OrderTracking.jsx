import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Package, Truck, CheckCircle2, AlertCircle, Calendar, Clock } from 'lucide-react';
import { getOrderByTrackingOrId, ORDER_STATUSES, getStatusIndex } from '../services/orderService';
import toast from 'react-hot-toast';

export default function OrderTracking() {
  const [searchParams] = useSearchParams();
  const [trackingId, setTrackingId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  // Extract query parameter if present on mount
  useEffect(() => {
    const orderParam = searchParams.get('order');
    if (orderParam) {
      setTrackingId(orderParam);
      performTracking(orderParam);
    }
  }, [searchParams]);

  const performTracking = async (searchVal) => {
    if (!searchVal || searchVal.trim().length < 3) return;
    setIsLoading(true);
    setError('');
    setOrder(null);
    
    try {
      const fetchedOrder = await getOrderByTrackingOrId(searchVal);
      if (fetchedOrder) {
        setOrder(fetchedOrder);
      } else {
        setError('No record found with that Order ID or Tracking ID.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while communicating with the database.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrackSubmit = (e) => {
    e.preventDefault();
    performTracking(trackingId);
  };

  const currentStatusIndex = order ? getStatusIndex(order.trackingStatus || order.orderStatus) : -1;

  // Formatting dates
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Awaiting update';
    const dateObj = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return dateObj.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const dateObj = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return dateObj.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen pt-32 pb-24 bg-slate-50 relative z-10">
      <div className="max-w-6xl mx-auto px-6">
        
        {/* Search Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-100 border border-cyan-200 text-cyan-600 text-xs font-bold uppercase tracking-wider">
            Fulfillment Tracking Portal
          </div>
          <h1 className="text-4xl font-black text-slate-800">Track Your Slime Order</h1>
          <p className="text-slate-500 font-medium">Enter your unique Order ID or Tracking ID to check status.</p>

          <form onSubmit={handleTrackSubmit} className="mt-8 flex gap-3 max-w-lg mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="e.g. FS-2026-123456" 
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all font-bold shadow-sm uppercase font-mono"
              />
            </div>
            <button type="submit" disabled={isLoading} className="px-8 py-4 bg-cyan-400 hover:bg-cyan-500 disabled:bg-slate-300 text-white font-black rounded-2xl shadow-lg shadow-cyan-200 transition-all active:scale-95">
              {isLoading ? 'Searching...' : 'Track'}
            </button>
          </form>
          {error && (
            <p className="text-red-500 text-sm font-bold flex items-center justify-center gap-2 mt-4">
              <AlertCircle className="w-4 h-4"/> {error}
            </p>
          )}
        </div>

        <AnimatePresence>
          {order && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              
              {/* Order Info Card */}
              <div className="bg-white border border-slate-200 rounded-[2rem] p-6 lg:p-8 flex flex-wrap gap-8 justify-between shadow-sm">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 font-sans">Order ID</p>
                  <p className="font-black text-slate-800 text-lg font-mono">{order.orderId}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 font-sans">Tracking Number</p>
                  <p className={`font-black text-lg font-mono ${order.trackingId ? 'text-cyan-500' : 'text-slate-400'}`}>{order.trackingId || 'Tracking number will be added once shipped'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 font-sans">Customer</p>
                  <p className="font-bold text-slate-700 text-base">{order.customer?.name || order.customerName}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 font-sans">Amount Paid</p>
                  <p className="font-black text-slate-800 text-base">₦{(order.amount || order.total || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 font-sans">Delivery Status</p>
                  <div className="inline-flex items-center gap-1.5 bg-green-50 text-green-600 px-3 py-1 rounded-lg border border-green-100 text-sm font-bold shadow-sm">
                    {order.trackingStatus === 'Delivered' ? (
                      <CheckCircle2 className="w-4 h-4"/>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    )} 
                    {order.trackingStatus || order.orderStatus}
                  </div>
                </div>
              </div>

              {/* Horizontal Timeline (Amazon-Style) */}
              <div className="bg-white border border-slate-200 rounded-[2rem] p-8 overflow-x-auto shadow-sm no-scrollbar">
                <div className="min-w-[800px] relative">
                  {/* Progress Line Background */}
                  <div className="absolute top-5 left-10 right-10 h-1 bg-slate-100 -z-10" />
                  {/* Active Progress Line */}
                  <div 
                    className="absolute top-5 left-10 h-1 bg-cyan-400 -z-10 transition-all duration-1000 ease-out" 
                    style={{ width: `${(Math.max(0, currentStatusIndex) / (ORDER_STATUSES.length - 1)) * 90}%` }} 
                  />

                  <div className="flex justify-between relative">
                    {ORDER_STATUSES.map((status, index) => {
                      const isCompleted = index <= currentStatusIndex;
                      const isCurrent = index === currentStatusIndex;
                      
                      return (
                        <div key={status} className="flex flex-col items-center flex-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm transition-all duration-500 mb-3 ${
                            isCompleted ? 'bg-cyan-400 text-white' : 'bg-slate-200 text-slate-400'
                          } ${isCurrent ? 'ring-4 ring-cyan-100 scale-110' : ''}`}>
                            {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <div className="w-2 h-2 rounded-full bg-slate-300" />}
                          </div>
                          <span className={`text-xs font-black text-center px-2 transition-colors ${
                            isCompleted ? 'text-slate-800' : 'text-slate-400'
                          }`}>
                            {status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Delivery Details Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Details Card */}
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
                    <h3 className="text-lg font-black text-slate-800 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-pink-500" /> Shipping Destination
                    </h3>
                    <p className="text-slate-600 font-medium text-sm leading-relaxed">
                      {order.customer?.address || order.address}
                    </p>
                    {order.customer?.landmark && (
                      <p className="text-xs text-slate-400 font-bold mt-2">
                        Landmark: {order.customer.landmark}
                      </p>
                    )}
                  </div>
                  
                  <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
                    <h3 className="text-lg font-black text-slate-800 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-cyan-500" /> Fulfillment Summary
                    </h3>
                    <div className="space-y-3 font-medium text-sm text-slate-600">
                      <div className="flex justify-between">
                        <span>Status Updated:</span>
                        <span className="font-bold text-slate-800">{formatDate(order.updatedAt || order.createdAt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Time Updated:</span>
                        <span className="font-bold text-slate-800">{formatTime(order.updatedAt || order.createdAt)}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-100 pt-3 text-slate-800">
                        <span>Courier Choice:</span>
                        <span className="font-black text-slate-800">{order.selectedCourier || 'DHL'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fulfillment Method:</span>
                        <span className="text-cyan-600 font-black">Flat-Rate manual dispatch</span>
                      </div>
                      {order.deliveryFee !== undefined && (
                        <div className="flex justify-between border-t border-slate-100 pt-3 text-slate-800 font-bold">
                          <span>Delivery Fee Charged:</span>
                          <span className="font-black">₦{order.deliveryFee.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Items & Shipping Info */}
                <div className="lg:col-span-2 bg-white border border-slate-200 shadow-sm rounded-[2rem] p-6 lg:p-8 flex flex-col space-y-6">
                  <div>
                    <h3 className="text-lg font-black text-slate-800 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                      <Package className="w-5 h-5 text-cyan-500" /> Items in Order
                    </h3>
                    <div className="space-y-4">
                      {order.items && order.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <div className="flex items-center gap-3">
                            {item.image && (
                              <img src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded-xl border border-slate-200" />
                            )}
                            <div>
                              <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                              <p className="text-xs text-slate-400 font-medium">Quantity: {item.quantity}</p>
                            </div>
                          </div>
                          <span className="font-black text-slate-800 text-sm">₦{(item.price * item.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-cyan-50/50 to-pink-50/50 border border-slate-100 rounded-2xl p-6 space-y-3">
                    <h4 className="text-sm font-black text-slate-800">Fulfillment Information</h4>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      Your package will be delivered via <strong>{order.selectedCourier || 'DHL'}</strong>. 
                      Once dispatch is confirmed, the courier tracking number will be updated here. If you have any inquiries, feel free to contact our support with your Order ID.
                    </p>
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
