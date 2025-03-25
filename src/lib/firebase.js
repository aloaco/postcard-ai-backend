import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// You can also store the path to your service account json file in .env
// GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
initializeApp();

export const db = getFirestore();