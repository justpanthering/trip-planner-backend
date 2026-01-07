import admin from "firebase-admin";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { readFileSync } from "fs";
import { join } from "path";

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  try {
    const serviceAccountPath = join(process.cwd(), "firebase-service.json");
    const serviceAccountJson = JSON.parse(
      readFileSync(serviceAccountPath, "utf-8")
    );
    initializeApp({
      credential: cert(serviceAccountJson),
    });
  } catch (error) {
    throw new Error(
      `Failed to initialize Firebase Admin: ${
        error instanceof Error ? error.message : "Unknown error"
      }. Please ensure firebase-service.json exists in the project root.`
    );
  }
}

export default admin;
