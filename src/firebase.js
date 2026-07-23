import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyD2ZyVvpHOjnAcJ4g3COPnGtlDApEZWtqM",
  authDomain: "csr-support-system.firebaseapp.com",
  projectId: "csr-support-system",
  storageBucket: "csr-support-system.firebasestorage.app",
  messagingSenderId: "47624755958",
  appId: "1:47624755958:web:f975cf59d567455fdcaad7",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
