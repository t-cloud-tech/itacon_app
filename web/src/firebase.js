import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "itacon-app",
  appId: "1:889001862943:web:7c9c09c666f0d4cf55f22a"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
