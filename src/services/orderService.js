import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';

// 6-Step Status Workflow
export const ORDER_STATUSES = [
  'Order Confirmed',
  'Preparing Slime',
  'Quality Check',
  'Packaging',
  'Handed to Courier',
  'In Transit',
  'Arrived at Local Hub',
  'Out for Delivery',
  'Delivered'
];

export const createOrder = async (orderData) => {
  try {
    const ordersRef = collection(db, 'orders');
    
    // Exact schema specified in database requirements
    const finalOrder = {
      orderId: orderData.orderId,
      trackingId: orderData.trackingId,
      customer: {
        name: orderData.customerName,
        email: orderData.email,
        phone: orderData.phone,
        address: orderData.address,
        landmark: orderData.landmark || '',
        notes: orderData.notes || ''
      },
      amount: orderData.total,
      paymentReference: orderData.paystackReference,
      paymentStatus: 'Paid',
      trackingStatus: 'Order Received',
      deliveryStatus: 'Order Received',
      items: orderData.items, // preserve items details
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(ordersRef, finalOrder);
    return docRef.id;
  } catch (error) {
    console.error("Error creating order: ", error);
    throw error;
  }
};

export const getOrderByTrackingOrId = async (searchId) => {
  try {
    const ordersRef = collection(db, 'orders');
    const cleanSearchId = searchId.trim().toUpperCase();
    
    // Search by trackingId
    const trackingQuery = query(ordersRef, where("trackingId", "==", cleanSearchId));
    const trackingSnapshot = await getDocs(trackingQuery);
    if (!trackingSnapshot.empty) {
      return { id: trackingSnapshot.docs[0].id, ...trackingSnapshot.docs[0].data() };
    }
    
    // Search by orderId
    const orderQuery = query(ordersRef, where("orderId", "==", cleanSearchId));
    const orderSnapshot = await getDocs(orderQuery);
    if (!orderSnapshot.empty) {
      return { id: orderSnapshot.docs[0].id, ...orderSnapshot.docs[0].data() };
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching order: ", error);
    throw error;
  }
};

// Get the numeric index of the status (0-5)
export const getStatusIndex = (status) => {
  return ORDER_STATUSES.indexOf(status);
};
