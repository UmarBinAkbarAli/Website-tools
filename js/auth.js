import { app } from './firebase.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// Initialize Firebase Auth instance
const auth = getAuth(app);
let callbacks = [];

// =============================
// INIT AUTH
// =============================
export function initAuth() {
  onAuthStateChanged(auth, user => {
    callbacks.forEach(cb => cb(user));
  });
}

export function onAuthReady(cb) {
  callbacks.push(cb);
}

// =============================
// GOOGLE LOGIN
// =============================
export function signInGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    return signInWithPopup(auth, provider);
  } catch (e) {
    return signInWithRedirect(auth, provider);
  }
}

// =============================
// EMAIL / PASSWORD AUTH HELPERS
// =============================
export function registerWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

// =============================
// OTHER HELPERS
// =============================
export function getCurrentUser() {
  return auth.currentUser;
}

export function signOutUser() {
  return auth.signOut();
}