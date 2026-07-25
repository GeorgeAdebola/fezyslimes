import { API_BASE } from './productService';

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
  throw new Error("Order creation should go through /api/verify-payment");
};

export const getOrderByTrackingOrId = async (searchId) => {
  try {
    const res = await fetch(`${API_BASE}/api/orders/search/${encodeURIComponent(searchId)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to search order');
    return await res.json();
  } catch (error) {
    console.error("Error fetching order: ", error);
    throw error;
  }
};

export const getStatusIndex = (status) => {
  return ORDER_STATUSES.indexOf(status);
};

export const getMyOrders = async (currentUser) => {
  try {
    if (!currentUser) throw new Error('You must be logged in to view your orders.');
    const idToken = await currentUser.getIdToken();
    const res = await fetch(`${API_BASE}/api/orders/my-orders`, {
      headers: { Authorization: `Bearer ${idToken}` }
    });
    if (!res.ok) throw new Error('Failed to fetch orders.');
    return await res.json();
  } catch (error) {
    console.error('Error fetching customer orders:', error);
    throw error;
  }
};
