import { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Background auto-refresh of user auth status (every 10s)
  useEffect(() => {
    if (!currentUser) return;
    
    const interval = setInterval(async () => {
      try {
        await currentUser.reload();
        const refreshedUser = auth.currentUser;
        // Check if verified status updated
        if (refreshedUser && refreshedUser.emailVerified !== currentUser.emailVerified) {
          // Shallow copy to force react update
          setCurrentUser(Object.assign(Object.create(Object.getPrototypeOf(refreshedUser)), refreshedUser));
        }
      } catch (err) {
        console.warn("Auth background reload failed: ", err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [currentUser]);

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function signup(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  function loginWithGoogle() {
    return signInWithPopup(auth, googleProvider);
  }

  function logout() {
    return signOut(auth);
  }

  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  function sendVerification() {
    if (auth.currentUser) {
      return sendEmailVerification(auth.currentUser);
    }
    return Promise.reject("No authenticated user active.");
  }

  const value = {
    currentUser,
    login,
    signup,
    loginWithGoogle,
    logout,
    resetPassword,
    sendVerification
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[999] bg-gradient-to-br from-teal-50 via-white to-pink-50 flex flex-col items-center justify-center">
        <div className="relative flex flex-col items-center">
          <div className="w-24 h-24 rounded-full border-4 border-cyan-100 border-t-pink-400 animate-spin absolute -top-4" />
          <img src="/logo.png" alt="FezySlimes Loading..." className="h-16 w-auto relative z-10 animate-pulse mt-4 drop-shadow-sm" />
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
