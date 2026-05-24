import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
    const app = express();
    const PORT = 3000;

    // API router
    const apiRouter = express.Router();

    apiRouter.get("/check-url", async (req, res) => {
        const url = req.query.url as string;
        if (!url) {
            return res.status(400).json({ error: "URL is required" });
        }
        try {
            const response = await fetch(url, { method: "HEAD" });
            res.json({ exists: response.ok });
        } catch (error) {
            res.json({ exists: false });
        }
    });

    app.use("/api", apiRouter);

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(__dirname, 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
