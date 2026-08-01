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

/**
 * Dynamically optimizes Cloudinary image/video URLs with auto quality, auto format, and width scaling.
 * @param {string} url - Cloudinary URL
 * @param {number} [width] - Target width in pixels (only applies to images)
 * @returns {string} Optimized URL
 */
export const optimizeCloudinaryUrl = (url, width) => {
  if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com')) return url;
  
  // If it already has transformations, don't modify it
  if (url.includes('/image/upload/q_') || url.includes('/video/upload/q_') || url.includes('/upload/f_auto')) {
    return url;
  }
  
  // Detect image vs video upload
  const isVideo = url.includes('/video/upload/') || url.match(/\.(mp4|webm|ogg|mov|avi|mkv)($|\?)/i);
  const uploadToken = isVideo ? '/video/upload/' : '/image/upload/';
  const replacementToken = isVideo ? '/video/upload/f_auto,q_auto/' : `/image/upload/f_auto,q_auto${width ? `,w_${width}` : ''}/`;
  
  if (url.includes(uploadToken)) {
    return url.replace(uploadToken, replacementToken);
  }
  
  // Generic fallback if path structure is slightly different (e.g. /upload/)
  if (url.includes('/upload/')) {
    const genericReplacement = isVideo ? '/upload/f_auto,q_auto/' : `/upload/f_auto,q_auto${width ? `,w_${width}` : ''}/`;
    return url.replace('/upload/', genericReplacement);
  }
  
  return url;
};
