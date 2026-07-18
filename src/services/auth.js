import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../firebase";

export function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
  return signOut(auth);
}
