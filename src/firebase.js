import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD2ZyVvpHOjnAcJ4g3COPnGtlDApEZWtqM",
  authDomain: "csr-support-system.firebaseapp.com",
  projectId: "csr-support-system",
  storageBucket: "csr-support-system.firebasestorage.app",
  messagingSenderId: "47624755958",
  appId: "1:47624755958:web:f975cf59d567455fdcaad7",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services and export them for use in the app
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
