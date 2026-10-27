import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc 
} from 'firebase/firestore';
import { UserProfile } from '../types';

import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Ensure local persistence so user session is maintained reliably across tabs and popups
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('Could not set browserLocalPersistence:', err);
  });
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Safe username generator based on email with non-blocking fallback
export async function generateUniqueUsername(email: string): Promise<string> {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const username = base || 'scholar';

  try {
    const q = query(collection(db, 'users'), where('username', '==', username));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return username;
    }
    return `${username}_${Math.floor(100 + Math.random() * 900)}`;
  } catch (err) {
    console.warn('Could not query username uniqueness, using random suffix:', err);
    return `${username}_${Math.floor(100 + Math.random() * 900)}`;
  }
}

// Resilient user profile synchronizer that retrieves the true profile from Firestore
export async function syncUserProfile(user: FirebaseUser): Promise<UserProfile> {
  const email = user.email || '';
  const isSuperAdmin = email.toLowerCase() === 'mr074770@gmail.com';
  // Super admin fallback is strictly 'mahfujur' to eliminate any email prefix ambiguity
  const defaultUsername = isSuperAdmin ? 'mahfujur' : (email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'scholar');

  const baselineProfile: UserProfile = {
    uid: user.uid,
    email: email,
    username: defaultUsername,
    photoURL: user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(defaultUsername)}`,
    createdAt: new Date().toISOString(),
    role: isSuperAdmin ? 'super_admin' : 'user',
    uploadCount: 0,
    likesReceived: 0
  };

  const userDocRef = doc(db, 'users', user.uid);

  try {
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const data = userDoc.data() as UserProfile;
      const trueUsername = data.username || defaultUsername;

      const merged: UserProfile = {
        ...data,
        email: email || data.email,
        username: trueUsername,
        photoURL: user.photoURL || data.photoURL || baselineProfile.photoURL,
        role: isSuperAdmin ? 'super_admin' : (data.role || 'user')
      };

      // Ensure super admin role and username in Firestore
      if (isSuperAdmin && (data.role !== 'super_admin' || data.username !== 'mahfujur')) {
        updateDoc(userDocRef, { role: 'super_admin', username: 'mahfujur' }).catch(() => {});
        merged.username = 'mahfujur';
        merged.role = 'super_admin';
      }
      return merged;
    }

    // First time user: generate username and save profile
    const username = isSuperAdmin ? 'mahfujur' : await generateUniqueUsername(email);
    const newProfile: UserProfile = {
      ...baselineProfile,
      username
    };

    await setDoc(userDocRef, newProfile).catch((writeErr) => {
      console.warn('Could not write user profile to Firestore:', writeErr);
    });

    addDoc(collection(db, 'notifications'), {
      userId: user.uid,
      title: 'Welcome to UU Qn Bank!',
      message: `Thank you for joining. Your username is @${username}.`,
      createdAt: new Date().toISOString(),
      read: false
    }).catch(() => {});

    return newProfile;
  } catch (err) {
    console.warn('Firestore profile lookup failed, continuing with baseline:', err);
    return baselineProfile;
  }
}

