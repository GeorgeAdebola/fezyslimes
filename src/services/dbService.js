import { API_BASE } from './productService';

const fetchWithAuth = async (url, options = {}, uid) => {
  // Try to get token from auth
  const { auth } = await import('../firebase');
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers
    }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Request failed');
  }
  return res.json();
};

export const getUserProfile = async (uid) => {
  return fetchWithAuth('/api/users/profile', {}, uid);
};

export const updateUserProfile = async (uid, data) => {
  return fetchWithAuth('/api/users/profile', { method: 'PUT', body: JSON.stringify(data) }, uid);
};

export const getWishlist = async (uid) => {
  return fetchWithAuth('/api/users/wishlist', {}, uid);
};

export const updateWishlist = async (uid, items) => {
  return fetchWithAuth('/api/users/wishlist', { method: 'PUT', body: JSON.stringify(items) }, uid);
};

export const getAddresses = async (uid) => {
  return fetchWithAuth('/api/users/addresses', {}, uid);
};

export const saveAddress = async (uid, address) => {
  const res = await fetchWithAuth('/api/users/addresses', { method: 'POST', body: JSON.stringify(address) }, uid);
  return res.id;
};

export const deleteAddress = async (uid, addressId) => {
  return fetchWithAuth(`/api/users/addresses/${addressId}`, { method: 'DELETE' }, uid);
};

export const setDefaultAddress = async (uid, addressId) => {
  return fetchWithAuth(`/api/users/addresses/${addressId}/default`, { method: 'PUT' }, uid);
};
