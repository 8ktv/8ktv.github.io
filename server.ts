import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VIEWS_FILE = path.join(process.cwd(), "views.json");

function getViews() {
    try {
        if (fs.existsSync(VIEWS_FILE)) {
            const data = fs.readFileSync(VIEWS_FILE, "utf-8");
            const parsed = JSON.parse(data);
            return typeof parsed.count === 'number' ? parsed.count : 0;
        }
    } catch (e) {
        console.error(e);
    }
    return 0;
}

function incrementViews() {
    const count = getViews() + 1;
    try {
        fs.writeFileSync(VIEWS_FILE, JSON.stringify({ count }), "utf-8");
    } catch (e) {
        console.error(e);
    }
    return count;
}

async function startServer() {
    const app = express();
    const PORT = 3000;

    if (!fs.existsSync(VIEWS_FILE)) {
        try {
            fs.writeFileSync(VIEWS_FILE, JSON.stringify({ count: 0 }), "utf-8");
        } catch (e) {
            console.error(e);
        }
    }

    app.use((req, res, next) => {
        if (req.url === "/" || req.url === "/index.html") {
            try {
                incrementViews();
            } catch (e) {}
        }
        next();
    });

    app.get("/api/views", (req, res) => {
        res.json({ count: getViews() });
    });

    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), "dist");
        app.use(express.static(distPath));
        app.get("*.html", (req, res, next) => {
            const filePath = path.join(distPath, req.path);
            if (fs.existsSync(filePath)) {
                res.sendFile(filePath);
            } else {
                next();
            }
        });
        app.get("*", (req, res) => {
            res.sendFile(path.join(distPath, "index.html"));
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
