import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Package, Truck, CheckCircle2, AlertCircle, Calendar, Clock } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { getOrderByTrackingOrId, ORDER_STATUSES, getStatusIndex } from '../services/orderService';
import toast from 'react-hot-toast';

// Leaflet default icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const deliveryIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-pink.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to dynamically adjust map view when position changes
function MapAnimation({ currentPos }) {
  const map = useMap();
  useEffect(() => {
    if (currentPos) {
      map.flyTo(currentPos, 13, { duration: 1.5 });
    }
  }, [currentPos, map]);
  return null;
}

export default function OrderTracking() {
  const [searchParams] = useSearchParams();
  const [trackingId, setTrackingId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  // Coordinates for delivery simulation (Lagos, Nigeria)
  const warehousePos = [6.5244, 3.3792]; // Lagos Mainland (HQ)
  const hubPos = [6.4698, 3.5852]; // Lekki Hub
  const customerPos = [6.4500, 3.6000]; // Target Customer Location

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

  // Interpolate courier location based on 9 tracking stages
  const getSimulatedCourierPosition = (statusIndex) => {
    if (statusIndex <= 3) return warehousePos; // Confirmed, Preparing, Quality Check, Packaging
    if (statusIndex === 4) return [6.5000, 3.4500]; // Handed to Courier
    if (statusIndex === 5) return [6.4800, 3.5200]; // In Transit
    if (statusIndex === 6) return hubPos; // Arrived at Local Hub
    if (statusIndex === 7) return [6.4600, 3.5900]; // Out for Delivery
    return customerPos; // Delivered
  };

  const currentStatusIndex = order ? getStatusIndex(order.trackingStatus || order.orderStatus) : -1;
  const courierPos = getSimulatedCourierPosition(currentStatusIndex);

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
            Live Tracking Portal
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
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 font-sans">Tracking ID</p>
                  <p className="font-black text-cyan-500 text-lg font-mono">{order.trackingId}</p>
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

              {/* Map & Stage Details */}
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
                      <Calendar className="w-5 h-5 text-cyan-500" /> Delivery Timeframe
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
                      <div className="flex justify-between border-t border-slate-100 pt-3 text-slate-800 font-bold">
                        <span>Estimated Arrival:</span>
                        <span className="text-cyan-600 font-black">
                          {order.shippingMethod === 'express' ? 'Next Day' : '3-5 Business Days'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Free Maps Leaflet Component */}
                <div className="lg:col-span-2 bg-white/90 backdrop-blur-xl border border-white shadow-xl shadow-pink-100/50 rounded-[2.5rem] overflow-hidden flex flex-col h-[450px]">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
                    <div>
                      <h3 className="text-base font-black text-slate-800">Free Live Route Mapping</h3>
                      <p className="text-xs font-bold text-slate-400">OpenStreetMap & Leaflet.js rendering</p>
                    </div>
                  </div>
                  
                  <div className="flex-1 relative bg-slate-100 z-0">
                    <MapContainer 
                      center={warehousePos} 
                      zoom={12} 
                      style={{ height: '100%', width: '100%' }}
                      zoomControl={false}
                    >
                      <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        attribution='&copy; OpenStreetMap'
                      />
                      
                      <Marker position={warehousePos}>
                        <Popup>FezySlimes HQ Warehouse</Popup>
                      </Marker>
                      
                      <Marker position={customerPos}>
                        <Popup>Customer Delivery Point</Popup>
                      </Marker>

                      {currentStatusIndex >= 2 && (
                        <Marker position={courierPos} icon={deliveryIcon}>
                          <Popup>FezySlimes Courier</Popup>
                        </Marker>
                      )}

                      <Polyline 
                        positions={[warehousePos, hubPos, customerPos]} 
                        color="#22d3ee" 
                        weight={4} 
                        dashArray="6, 6" 
                        opacity={0.7}
                      />

                      <MapAnimation currentPos={courierPos} />
                    </MapContainer>
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
