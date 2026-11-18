import { app } from "../server";

// Route every /api/* request through the Express application without
// rewriting the request path (billing, health, OCR, and other API routes).
export default app;
