import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export function getUserProfile(uid) {
  return getDoc(doc(db, "users", uid));
}
