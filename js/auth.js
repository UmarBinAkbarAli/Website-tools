import { app } from './firebase.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
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

// export function signInGoogle() {
//  return signInWithPopup(auth, new GoogleAuthProvider());
// }

// added this funtion on the replacement of above commented lines if anythings break wil revert this

export function signInGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    return signInWithPopup(auth, provider);
  } catch (e) {
    return signInWithRedirect(auth, provider);
  }
}
// this ends here for nishaani

// =============================
// EMAIL/PASSWORD AUTH HELPERS
// =============================
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

export function registerWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}


export function getCurrentUser() {
  return auth.currentUser;
}

export function signOutUser() {
  return auth.signOut();
}
