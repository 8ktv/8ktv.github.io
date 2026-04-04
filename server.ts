import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
    const app = express();
    const httpServer = createServer(app);
    const io = new Server(httpServer);

    const PORT = 3000;

    // In-memory message store
    const messages: { id: string; user: string; text: string; timestamp: number }[] = [];

    io.on("connection", (socket) => {
        console.log("A user connected");

        // Send existing messages to the new user
        socket.emit("init_messages", messages);

        socket.on("send_message", (data) => {
            const newMessage = {
                id: Math.random().toString(36).substring(2, 9),
                user: data.user || "Anonymous",
                text: data.text,
                timestamp: Date.now(),
            };
            messages.push(newMessage);
            if (messages.length > 100) messages.shift(); // Keep last 100 messages

            io.emit("new_message", newMessage);
        });

        socket.on("disconnect", () => {
            console.log("User disconnected");
        });
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), "dist");
        app.use(express.static(distPath));
        app.get("*", (req, res) => {
            res.sendFile(path.join(distPath, "index.html"));
        });
    }

    httpServer.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
