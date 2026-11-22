import { app } from "../../server";

// Explicit Vercel function route for permanent account deletion.
// Keep this path separate from the catch-all API handler so the request
// cannot fall through to the SPA's index.html with HTTP 200.
export default app;
