import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB8Uarm1Wfr9gfCGhohvSBNpT3zBpzAyYQ",
  authDomain: "slime-business.firebaseapp.com",
  projectId: "slime-business",
  storageBucket: "slime-business.appspot.com",
  messagingSenderId: "1056410131791",
  appId: "1:1056410131791:web:dbee93e059d2900d10b93a",
  measurementId: "G-6JSP3BKPLQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const storage = getStorage(app);
export const db = getFirestore(app);

export default app;
