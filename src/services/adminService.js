import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

export const updateOrderStatus = async (docId, newStatus, trackingInfo = null) => {
  try {
    const orderRef = doc(db, 'orders', docId);
    const updates = { orderStatus: newStatus };
    
    if (trackingInfo) {
      // Allow admin to push manual tracking location updates
      updates.trackingInfo = trackingInfo;
    }
    
    await updateDoc(orderRef, updates);
  } catch (error) {
    console.error("Error updating order status: ", error);
    throw error;
  }
};
