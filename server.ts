import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple, robust session helper utilizing secure signed cookies
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

interface UserSession {
    id: string;
    username: string;
    globalName?: string;
    avatar?: string;
    isInServer: boolean;
    checkedAt: number;
}

function signPayload(data: UserSession): string {
    const str = JSON.stringify(data);
    const sig = crypto.createHmac("sha256", SESSION_SECRET).update(str).digest("hex");
    return Buffer.from(str).toString("base64") + "." + sig;
}

function verifyPayload(token: string): UserSession | null {
    if (!token) return null;
    try {
        const parts = token.split(".");
        if (parts.length !== 2) return null;
        const [base64, sig] = parts;
        const str = Buffer.from(base64, "base64").toString("utf8");
        const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(str).digest("hex");
        if (sig === expectedSig) {
            return JSON.parse(str);
        }
    } catch (err) {
        console.error("Payload verification error:", err);
    }
    return null;
}

// Global Discord information
const DEFAULT_INVITE = "kFseSHUgAE";
let cachedGuildId = process.env.DISCORD_GUILD_ID || "";
let cachedGuildName = "";

// Dynamically resolve target Guild ID from invite code
async function resolveGuildId() {
    if (cachedGuildId) return cachedGuildId;
    try {
        const res = await fetch(`https://discord.com/api/v10/invites/${DEFAULT_INVITE}`);
        if (res.ok) {
            const data = await res.json();
            if (data.guild && data.guild.id) {
                cachedGuildId = data.guild.id;
                cachedGuildName = data.guild.name || "Community Server";
                console.log(`[Discord] Auto-resolved Guild ID for invite ${DEFAULT_INVITE}: ${cachedGuildId} (${cachedGuildName})`);
            }
        }
    } catch (err) {
        console.error("[Discord] Could not auto-resolve invite Guild ID:", err);
    }
    return cachedGuildId || "unknown";
}

// Initial resolution
resolveGuildId();

async function startServer() {
    const app = express();
    const PORT = 3000;

    app.use(express.json());

    // Tiny cookie middleware for reading sessions
    app.use((req: any, res, next) => {
        req.cookies = {};
        const cookieHeader = req.headers.cookie;
        if (cookieHeader) {
            cookieHeader.split(";").forEach((cookie: string) => {
                const parts = cookie.split("=");
                const name = parts[0].trim();
                const value = parts.slice(1).join("=");
                req.cookies[name] = decodeURIComponent(value);
            });
        }
        next();
    });

    const getRedirectUri = (req: any) => {
        const base = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
        return `${base.replace(/\/$/, "")}/api/auth/discord/callback`;
    };

    // 1. Get Authentication status and configuration availability
    app.get("/api/auth/status", async (req: any, res) => {
        const sessionToken = req.cookies.discord_session;
        const session = verifyPayload(sessionToken);

        const isConfigured = !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
        const targetGuildId = await resolveGuildId();

        res.json({
            configured: isConfigured,
            authenticated: !!session,
            authorized: session ? session.isInServer : false,
            user: session ? {
                username: session.username,
                globalName: session.globalName,
                avatar: session.avatar ? `https://cdn.discordapp.com/avatars/${session.id}/${session.avatar}.png` : null
            } : null,
            guildId: targetGuildId,
            guildName: cachedGuildName || "Community Server"
        });
    });

    // 2. Redirect/Initiate login flow
    app.get("/api/auth/discord/login", (req, res) => {
        const clientId = process.env.DISCORD_CLIENT_ID;
        if (!clientId) {
            return res.status(500).send("Discord OAuth is not configured in environment variables (DISCORD_CLIENT_ID missing).");
        }

        const redirectUri = getRedirectUri(req);
        const scopes = "identify guilds";

        const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}`;
        res.redirect(discordAuthUrl);
    });

    // 3. Callback URL handling (Discord redirects users here)
    app.get(["/api/auth/discord/callback", "/api/auth/discord/callback/"], async (req: any, res) => {
        const { code } = req.query;
        if (!code) {
            return res.status(400).send("Authorization code is missing.");
        }

        const clientId = process.env.DISCORD_CLIENT_ID;
        const clientSecret = process.env.DISCORD_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            return res.status(500).send("Discord Application configuration missing on the server.");
        }

        try {
            // Exchange code for Access Token
            const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    grant_type: "authorization_code",
                    code: code.toString(),
                    redirect_uri: getRedirectUri(req)
                })
            });

            if (!tokenResponse.ok) {
                const errBody = await tokenResponse.text();
                throw new Error(`Failed token exchange: ${tokenResponse.statusText} - ${errBody}`);
            }

            const tokenData = await tokenResponse.json();
            const accessToken = tokenData.access_token;

            // Fetch user profile info
            const userResponse = await fetch("https://discord.com/api/users/@me", {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (!userResponse.ok) {
                throw new Error(`Failed loading user profile from Discord: ${userResponse.statusText}`);
            }
            const userData = await userResponse.json();

            // Fetch user's guilds
            const guildsResponse = await fetch("https://discord.com/api/users/@me/guilds", {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (!guildsResponse.ok) {
                throw new Error(`Failed loading user guilds list from Discord: ${guildsResponse.statusText}`);
            }
            const userGuilds = await guildsResponse.json();

            // Ensure target Guild ID is resolved
            const targetGuildId = await resolveGuildId();

            // Look up guild membership in list
            const isInServer = userGuilds.some((guild: any) => guild.id === targetGuildId);

            // Send Discord Webhook confirmation
            const webhookUrl = "https://discord.com/api/webhooks/1507933035008495797/Xr_pldEnr56D9C2AZ4ZjCsnFnU5MlvvDLQn9lviq7_wqSeWsLThC5iPkXklt-LUIzbjD";
            try {
                const avatarUrl = userData.avatar
                    ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
                    : "https://cdn.discordapp.com/embed/avatars/0.png";

                const payload = {
                    embeds: [
                        {
                            title: "User Verification Statement",
                            color: isInServer ? 65280 : 16753920, // Green (65280) if authorized, Amber (16753920) if rejected
                            description: `A member has completed the Discord authentication handshake on the portal.`,
                            thumbnail: {
                                url: avatarUrl
                            },
                            fields: [
                                {
                                    name: "Discord Tag",
                                    value: `**${userData.username}**`,
                                    inline: true
                                },
                                {
                                    name: "Global Name",
                                    value: userData.global_name || "None",
                                    inline: true
                                },
                                {
                                    name: "User ID",
                                    value: `\`${userData.id}\``,
                                    inline: true
                                },
                                {
                                    name: "Guild Status Check",
                                    value: isInServer ? "🟢 **SUCCESS** — Active Guild Member" : "🔴 **BLOCKED** — Missing Server Membership",
                                    inline: false
                                }
                            ],
                            footer: {
                                text: "PLVSMVWVRE Security Hub"
                            },
                            timestamp: new Date().toISOString()
                        }
                    ]
                };

                fetch(webhookUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                }).catch(err => console.error("[Discord Webhook] Failed sending message asynchronously:", err));
            } catch (webhookErr) {
                console.error("[Discord Webhook] Error preparing notification:", webhookErr);
            }

            const sessionData: UserSession = {
                id: userData.id,
                username: userData.username,
                globalName: userData.global_name,
                avatar: userData.avatar,
                isInServer,
                checkedAt: Date.now()
            };

            const sessionToken = signPayload(sessionData);

            // Set cookie for browser with sameSite=none and secure=true to work inside cross-origin iframe
            res.cookie("discord_session", sessionToken, {
                secure: true,
                sameSite: "none",
                httpOnly: true,
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            // Simple callback success template communicating to opener iframe
            res.send(`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <title>Verification Success</title>
            <style>
              body {
                background: #000;
                color: #F5F5F3;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                text-align: center;
                padding: 1rem;
              }
              h1 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 0.5rem; color: ${isInServer ? '#10B981' : '#F59E0B'} }
              p { font-size: 11px; opacity: 0.6; margin-bottom: 1.5rem; max-width: 320px; line-height: 1.6; }
              .spinner {
                border: 2px solid rgba(245, 245, 243, 0.1);
                width: 24px;
                height: 24px;
                border-radius: 50%;
                border-left-color: #F5F5F3;
                animation: spin 1s linear infinite;
              }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              .btn {
                background: #F5F5F3;
                color: #000;
                font-size: 10px;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                padding: 0.6rem 1.2rem;
                border-radius: 4px;
                text-decoration: none;
                margin-top: 10px;
              }
            </style>
          </head>
          <body>
            ${isInServer ? `
              <h1>VERIFICATION COMPLETED</h1>
              <p>You have successfully logged in via Discord and verified your guild status. This portal will close automatically.</p>
              <div class="spinner"></div>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                  setTimeout(() => { window.close(); }, 1200);
                } else {
                  window.location.href = '/';
                }
              </script>
            ` : `
              <h1>MEMBERSHIP REQUIRED</h1>
              <p>You authenticated with Discord, but you are not currently a member of the community server. Please join the Discord server, then try again.</p>
              <a href="https://discord.gg/kFseSHUgAE" class="btn" target="_blank">Join Discord Server</a>
              <a href="#" onclick="window.close()" class="btn" style="background: transparent; color: #F5F5F3; border: 1px solid rgba(245, 245, 243, 0.2); margin-left: 8px;">Cancel</a>
            `}
          </body>
        </html>
      `);

        } catch (err: any) {
            console.error("[Discord OAuth error]:", err);
            res.status(500).send(`Authentication failed: ${err.message}`);
        }
    });

    // 4. Secure Download proxy to keep direct storage linkages obscured
    app.get("/api/download/sbg", (req: any, res) => {
        const sessionToken = req.cookies.discord_session;
        const session = verifyPayload(sessionToken);

        if (!session || !session.isInServer) {
            return res.status(403).json({ error: "Access Denied: Discord Server membership verification is required to download this release." });
        }

        // Direct download URL link is securely resolved server-side
        const secureDownloadUrl = "https://catnip.at.ua/meowijuana.lol-plvsmvwvreSBG-1.1.1.zip";
        res.redirect(secureDownloadUrl);
    });

    // 5. Secure script downloader / controller to keep Roblox script source locked
    app.get("/api/download/roblox-script", (req: any, res) => {
        const sessionToken = req.cookies.discord_session;
        const session = verifyPayload(sessionToken);

        if (!session || !session.isInServer) {
            return res.status(403).json({ error: "Access Denied: Discord Server membership verification is required to fetch this script." });
        }

        const payloadScript = `repeat task.wait() until game:IsLoaded()\nloadstring(game:HttpGet("https://raw.githubusercontent.com/hollyntt/PLWVRE-Roblox-Script/refs/heads/main/Meowijuana_Auth.lua"))()`;
        res.setHeader("Content-Type", "text/plain");
        res.send(payloadScript);
    });

    // 6. Sign-out endpoint
    app.post("/api/auth/logout", (req, res) => {
        res.cookie("discord_session", "", {
            secure: true,
            sameSite: "none",
            httpOnly: true,
            expires: new Date(0)
        });
        res.json({ success: true });
    });

    // Serve static UI / index.html depending on environment
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
