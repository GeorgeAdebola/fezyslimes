/**
 * productService.js
 * 
 * Single source of truth for all product-related API calls on the frontend.
 * Both the storefront (Home, QuickView, Cart) and the Admin panel fetch from
 * the same Express + Firestore backend via these helpers.
 * 
 * The API base URL is injected via VITE_API_BASE so it works in:
 *   - Local dev   → http://localhost:5000  (set in .env.local)
 *   - Production  → https://your-backend.railway.app  (set in Vercel env vars)
 */

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

/**
 * Fetch all products from Firestore (via the backend).
 * @returns {Promise<Array>} Array of product objects
 */
export const fetchProducts = async () => {
  const res = await fetch(`${API_BASE}/api/products`);
  if (!res.ok) throw new Error('Failed to fetch products. Is the server running?');
  return res.json();
};

/**
 * Fetch a single product by its Firestore document ID.
 * @param {string} id - Firestore document ID
 * @returns {Promise<Object>} Product object
 */
export const fetchProductById = async (id) => {
  const res = await fetch(`${API_BASE}/api/products/${id}`);
  if (!res.ok) throw new Error('Product not found.');
  return res.json();
};
