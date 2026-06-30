import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
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
const db = getFirestore(app);

export { db, collection, addDoc, getDocs, query, orderBy, serverTimestamp };
