// firebase.js - single unified initialization

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDXsrypUfViIDCdK5Bs0H-P-J9KXYONajU",
  authDomain: "umar-tools-27994.firebaseapp.com",
  projectId: "umar-tools-27994",
  storageBucket: "umar-tools-27994.firebasestorage.app",
  messagingSenderId: "269972336658",
  appId: "1:269972336658:web:0fbcd8ecd1047b888e68cb"
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
