import { db } from '../firebase';
import { collection, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

/**
 * Realtime listener for Firestore products collection.
 * Calls callback(productsArray) live whenever products are created, updated, or deleted.
 * @param {Function} callback 
 * @param {Function} onError 
 * @returns {Function} Unsubscribe cleanup function
 */
export const subscribeProducts = (callback, onError) => {
  try {
    const unsubscribe = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        const products = [];
        snapshot.forEach((docSnap) => {
          products.push({ id: docSnap.id, ...docSnap.data() });
        });
        callback(products);
      },
      (error) => {
        console.error('[productService] Realtime listener error:', error);
        if (onError) onError(error);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('[productService] Failed to establish realtime listener:', err);
    if (onError) onError(err);
    return () => {};
  }
};

/**
 * Fetch all products from Firestore (via backend API or direct Firestore fallback).
 * @returns {Promise<Array>} Array of product objects
 */
export const fetchProducts = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/products`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[productService] Backend API fetch failed, trying direct Firestore fallback:', err);
  }

  // Direct Firestore fallback
  try {
    const querySnapshot = await getDocs(collection(db, 'products'));
    const products = [];
    querySnapshot.forEach((docSnap) => {
      products.push({ id: docSnap.id, ...docSnap.data() });
    });
    return products;
  } catch (firestoreErr) {
    console.error('[productService] Firestore fallback failed:', firestoreErr);
    throw new Error('Failed to load products.');
  }
};

/**
 * Fetch a single product by its Firestore document ID.
 * @param {string} id - Firestore document ID
 * @returns {Promise<Object>} Product object
 */
export const fetchProductById = async (id) => {
  try {
    const res = await fetch(`${API_BASE}/api/products/${id}`);
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn('[productService] Backend fetch by ID failed, trying direct Firestore fallback:', err);
  }

  try {
    const docSnap = await getDoc(doc(db, 'products', id));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
  } catch (firestoreErr) {
    console.error('[productService] Firestore getDoc failed:', firestoreErr);
  }
  throw new Error('Product not found.');
};
