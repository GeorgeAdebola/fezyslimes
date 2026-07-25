import { API_BASE } from './productService';

export const updateOrderStatus = async (docId, newStatus, trackingInfo = null) => {
  try {
    // Admin routes are protected by a JWT stored in localStorage — NOT a Firebase token.
    const adminToken = localStorage.getItem('fezyslimes_admin_token');
    if (!adminToken) throw new Error('Not authenticated as admin');

    // Send to the backend endpoint
    const updates = { trackingStatus: newStatus, deliveryStatus: newStatus };
    if (trackingInfo) {
      updates.trackingId = trackingInfo;
    }
    
    const res = await fetch(`${API_BASE}/api/admin/orders/${encodeURIComponent(docId)}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify(updates)
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to update order status');
    }
  } catch (error) {
    console.error("Error updating order status: ", error);
    throw error;
  }
};
