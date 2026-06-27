import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Safe import with fallback
let firebaseConfig: any = {};
try {
  // @ts-ignore
  firebaseConfig = (await import('../../../firebase-applet-config.json')).default || {};
} catch (e) {
  console.warn('Firebase config not found or invalid. Using empty config.');
  firebaseConfig = {};
}

let app: any;
let db: any;
let auth: any;

try {
  if (firebaseConfig && Object.keys(firebaseConfig).length > 0) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    auth = getAuth(app);
  } else {
    console.error('Firebase config is empty. App may not work with Firebase features.');
  }
} catch (err) {
  console.error('Firebase initialization failed:', err);
}

export { db, auth };