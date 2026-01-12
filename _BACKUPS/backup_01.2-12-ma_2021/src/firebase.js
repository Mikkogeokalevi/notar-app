import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // <--- UUSI RIVI

const firebaseConfig = {
  apiKey: "AIzaSyDd7oNAtznb5DT6R6yAP7Y1yMeVoY4fKhU",
  authDomain: "notar-app.firebaseapp.com",
  projectId: "notar-app",
  storageBucket: "notar-app.firebasestorage.app",
  messagingSenderId: "620852234294",
  appId: "1:620852234294:web:e32df64dccc8a2b8ed3097"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app); // <--- UUSI RIVI