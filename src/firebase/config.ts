import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
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
  orderBy,
  limit,
  addDoc,
  updateDoc
} from 'firebase/firestore';
import { UserProfile } from '../types';

import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

// Auto-username generator based on email
export async function generateUniqueUsername(email: string): Promise<string> {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  let username = base || 'user';
  let counter = 1;
  
  while (true) {
    const q = query(collection(db, 'users'), where('username', '==', username));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return username;
    }
    counter++;
    username = `${base}${counter}`;
  }
}

// Check or create user profile on login
export async function syncUserProfile(user: FirebaseUser): Promise<UserProfile> {
  const userDocRef = doc(db, 'users', user.uid);
  const userDoc = await getDoc(userDocRef);
  
  if (userDoc.exists()) {
    const data = userDoc.data() as UserProfile;
    const email = user.email || '';
    if (email.toLowerCase() === 'mr074770@gmail.com' && data.role !== 'super_admin') {
      const updatedProfile = { ...data, role: 'super_admin' as const };
      await updateDoc(userDocRef, { role: 'super_admin' });
      return updatedProfile;
    }
    return data;
  }
  
  // Create profile
  const email = user.email || '';
  const isSuperAdmin = email.toLowerCase() === 'mr074770@gmail.com';
  const username = await generateUniqueUsername(email);
  
  const newProfile: UserProfile = {
    uid: user.uid,
    email: email,
    username: username,
    photoURL: user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`,
    createdAt: new Date().toISOString(),
    role: isSuperAdmin ? 'super_admin' : 'user',
    uploadCount: 0,
    likesReceived: 0
  };
  
  await setDoc(userDocRef, newProfile);
  
  // Seed initial activities/notifications or add early contributor badge if applicable
  await addDoc(collection(db, 'notifications'), {
    userId: user.uid,
    title: 'Welcome to UU Qn Bank!',
    message: `Thank you for joining. Your username is @${username}.`,
    createdAt: new Date().toISOString(),
    read: false
  });

  return newProfile;
}
