import admin from "firebase-admin";
import { initializeApp, getApps, cert } from "firebase-admin/app";

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!serviceAccount) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT environment variable is required"
    );
  }

  try {
    const serviceAccountJson = JSON.parse(serviceAccount);
    initializeApp({
      credential: cert(serviceAccountJson),
    });
  } catch (error) {
    throw new Error(
      "Invalid FIREBASE_SERVICE_ACCOUNT JSON. Please provide a valid service account JSON string."
    );
  }
}

export default admin;
