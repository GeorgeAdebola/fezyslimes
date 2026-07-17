import { db } from '../firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  deleteDoc, 
  writeBatch,
  query,
  where
} from 'firebase/firestore';

// --- PROFILE CRUD ---
export const getUserProfile = async (uid) => {
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return {
      displayName: '',
      phoneNumber: '',
      notifications: {
        orderUpdates: true,
        promotions: false
      }
    };
  } catch (error) {
    console.error("Error getting user profile: ", error);
    throw error;
  }
};

export const updateUserProfile = async (uid, data) => {
  try {
    const docRef = doc(db, 'users', uid);
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    console.error("Error updating user profile: ", error);
    throw error;
  }
};

// --- WISHLIST CRUD ---
export const getWishlist = async (uid) => {
  try {
    const docRef = doc(db, 'wishlists', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().items || [];
    }
    return [];
  } catch (error) {
    console.error("Error getting wishlist: ", error);
    throw error;
  }
};

export const updateWishlist = async (uid, items) => {
  try {
    const docRef = doc(db, 'wishlists', uid);
    await setDoc(docRef, { items }, { merge: true });
  } catch (error) {
    console.error("Error updating wishlist: ", error);
    throw error;
  }
};

// --- SAVED ADDRESSES CRUD ---
export const getAddresses = async (uid) => {
  try {
    const colRef = collection(db, 'users', uid, 'addresses');
    const querySnapshot = await getDocs(colRef);
    const addresses = [];
    querySnapshot.forEach((doc) => {
      addresses.push({ id: doc.id, ...doc.data() });
    });
    return addresses;
  } catch (error) {
    console.error("Error getting addresses: ", error);
    throw error;
  }
};

export const saveAddress = async (uid, address) => {
  try {
    const addressId = address.id || doc(collection(db, 'temp')).id;
    const docRef = doc(db, 'users', uid, 'addresses', addressId);
    
    const finalAddress = {
      ...address,
      id: addressId,
      isDefault: address.isDefault || false
    };

    // If setting as default, make all other addresses non-default
    if (finalAddress.isDefault) {
      await clearDefaultAddresses(uid);
    }

    await setDoc(docRef, finalAddress, { merge: true });
    return addressId;
  } catch (error) {
    console.error("Error saving address: ", error);
    throw error;
  }
};

export const deleteAddress = async (uid, addressId) => {
  try {
    const docRef = doc(db, 'users', uid, 'addresses', addressId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting address: ", error);
    throw error;
  }
};

export const setDefaultAddress = async (uid, addressId) => {
  try {
    await clearDefaultAddresses(uid);
    const docRef = doc(db, 'users', uid, 'addresses', addressId);
    await updateDoc(docRef, { isDefault: true });
  } catch (error) {
    console.error("Error setting default address: ", error);
    throw error;
  }
};

const clearDefaultAddresses = async (uid) => {
  const colRef = collection(db, 'users', uid, 'addresses');
  const snapshot = await getDocs(colRef);
  const batch = writeBatch(db);
  snapshot.forEach((doc) => {
    if (doc.data().isDefault) {
      batch.update(doc.ref, { isDefault: false });
    }
  });
  await batch.commit();
};
