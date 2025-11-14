// auth.js – Firebase Authentication

import { app } from './firebase.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

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
