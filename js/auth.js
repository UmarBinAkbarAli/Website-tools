// =====================================
// auth.js – Firebase Authentication
// =====================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// =============================
// Your Firebase Config
// =============================
const firebaseConfig = {
  apiKey: "AIzaSyDXsrypUfViIDCdK5Bs0H-P-J9KXYONajU",
  authDomain: "umar-tools-27994.firebaseapp.com",
  projectId: "umar-tools-27994",
  storageBucket: "umar-tools-27994.firebasestorage.app",
  messagingSenderId: "269972336658",
  appId: "1:269972336658:web:0fbcd8ecd1047b888e68cb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let callbacks = [];

export function initAuth() {
  onAuthStateChanged(auth, (user) => {
    callbacks.forEach(cb => cb(user));
  });
}

export function onAuthReady(cb) {
  callbacks.push(cb);
}

export async function signInGoogle() {
  const provider = new GoogleAuthProvider();
  return await signInWithPopup(auth, provider);
}

export async function signInGuest() {
  return await signInAnonymously(auth);
}

export function getCurrentUser() {
  return auth.currentUser;
}

export async function signOutUser() {
  return await auth.signOut();
}
