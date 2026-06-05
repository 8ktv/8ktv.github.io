import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Set up JSON configurations and parsing limit for image payloads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Initialize Google Gemini Client
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
        headers: {
            "User-Agent": "aistudio-build",
        },
    },
});

// API endpoint to parse player report screenshot or raw text
app.post("/api/parse-report", async (req, res) => {
    try {
        const { text, image, mimeType } = req.body;

        if (!text && !image) {
            return res.status(400).json({ error: "Empty request. Please provide a report screenshot or paste text." });
        }

        const contents: any[] = [];

        // Construct request parts
        if (image && mimeType) {
            contents.push({
                inlineData: {
                    mimeType: mimeType,
                    data: image, // base64 payload
                },
            });
        }

        const promptText = `
      You are a specialized player report parser. Extract structured information from this player report image or text excerpt.
      Provide precise extraction of the fields shown, particularly reporter and reported usernames (including the "@" symbol), numeric IDs, CoC categories, detail descriptions, avatar heights, room indices/types, and timestamps.
      
      Here is any text context: ${text || "N/A"}
      
      Extract as much detail as possible. If a field is not present, leave it blank or null.
    `;

        contents.push({ text: promptText });

        const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: { parts: contents },
            config: {
                systemInstruction: "You are a professional assistant designed to extract structure from game moderation dashboards and player tickets. Always output compliant JSON.",
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        reporterName: { type: Type.STRING, description: "Username or tag of the reporter, e.g. @recreation" },
                        reporterId: { type: Type.STRING, description: "Numeric ID in parenthesis next to the reporter, e.g. 14440" },
                        reportedName: { type: Type.STRING, description: "Username or tag of the reported player, e.g. @purrfectmeow99" },
                        reportedId: { type: Type.STRING, description: "Numeric ID in parenthesis next to the reported player, e.g. 492468947" },
                        category: { type: Type.STRING, description: "The violation class, e.g. CoC: Underage (100) or CoC: Toxic (3)" },
                        details: { type: Type.STRING, description: "Detailed reasons or details of the report, e.g. Player sounds or acts under 13" },
                        heightReporter: { type: Type.STRING, description: "Value from height section for reporter e.g. 1.51" },
                        heightReported: { type: Type.STRING, description: "Value from height section for reported player e.g. 1.19" },
                        roomId: { type: Type.STRING, description: "Room id, e.g. 3" },
                        roomType: { type: Type.STRING, description: "Room type, e.g. 0" },
                        timestamp: { type: Type.STRING, description: "The time described such as Today at 4:51 AM or relative duration" }
                    }
                },
            },
        });

        if (!response.text) {
            throw new Error("No response text from Gemini");
        }

        const parsedData = JSON.parse(response.text.trim());
        return res.json(parsedData);
    } catch (error: any) {
        console.error("Gemini Parsing Error:", error);
        return res.status(500).json({ error: error.message || "Failed to parse report." });
    }
});

// Proxy to send webhook payload directly to Discord to bypass CORS issues
app.post("/api/send-webhook", async (req, res) => {
    try {
        const { webhookUrl, payload, fileBase64, fileMime, fileName } = req.body;
        if (!webhookUrl) {
            return res.status(400).json({ error: "Missing Discord Webhook URL" });
        }
        if (!payload) {
            return res.status(400).json({ error: "Missing Webhook Payload" });
        }

        let discordResponse;

        if (fileBase64 && fileMime && fileName) {
            // Construct native multipart payload
            const formData = new globalThis.FormData();
            formData.append("payload_json", JSON.stringify(payload));

            const buffer = Buffer.from(fileBase64, "base64");
            const blob = new globalThis.Blob([buffer], { type: fileMime });
            formData.append("files[0]", blob, fileName);

            discordResponse = await fetch(webhookUrl, {
                method: "POST",
                body: formData,
            });
        } else {
            discordResponse = await fetch(webhookUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });
        }

        if (!discordResponse.ok) {
            const errorText = await discordResponse.text();
            return res.status(discordResponse.status).json({
                error: `Discord Webhook error: ${errorText || discordResponse.statusText}`,
            });
        }

        return res.json({ success: true });
    } catch (err: any) {
        console.error("Webhook Delivery Failure:", err);
        return res.status(500).json({ error: err.message || "Could not forward payload to Discord." });
    }
});

// Configure Vite middleware or static serving
async function configureEndpoints() {
    if (process.env.NODE_ENV !== "production") {
        console.log("Configuring Vite middleware for development");
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        console.log("Serving static production assets");
        const distPath = path.join(process.cwd(), "dist");
        app.use(express.static(distPath));
        app.get("*", (req, res) => {
            res.sendFile(path.join(distPath, "index.html"));
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server is running at http://0.0.0.0:${PORT}`);
    });
}

configureEndpoints().catch((err) => {
    console.error("Server Setup Failure:", err);
});
