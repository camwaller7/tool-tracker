// Local dev entry — starts the same Express app that Vercel runs as a function.
import app from './app.js';

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Tool Tracker API on http://localhost:${PORT}`));
