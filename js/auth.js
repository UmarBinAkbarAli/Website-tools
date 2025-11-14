import { app } from './firebase.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

const auth = getAuth(app);
let callbacks = [];

export function initAuth() {
  onAuthStateChanged(auth, user => {
    callbacks.forEach(cb => cb(user));
  });
}

export function onAuthReady(cb) {
  callbacks.push(cb);
}

export function signInGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export function getCurrentUser() {
  return auth.currentUser;
}

export function signOutUser() {
  return auth.signOut();
}
