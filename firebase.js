import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCYsmBqDE-e-Q9dnekUiJKpmtSrM4vRifg",
  authDomain: "atnoc-3ff7c.firebaseapp.com",
  projectId: "atnoc-3ff7c",
  storageBucket: "atnoc-3ff7c.firebasestorage.app",
  messagingSenderId: "143290387195",
  appId: "1:143290387195:web:7ae7cd1c92deb3c49d7e5e",
  measurementId: "G-KQFB3T1RM0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  auth,
  db,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp
};
