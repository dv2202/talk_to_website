import { experimental_upgradeWebSocket, type WebSocketData } from "@vercel/functions";
import { connection } from "next/server";
import {
    handleLiveClientMessage,
    registerLiveConnection,
    unregisterLiveConnection,
} from "@/lib/live-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toText(data: WebSocketData): string {
    if (typeof data === "string") return data;
    if (Buffer.isBuffer(data)) return data.toString();
    if (Array.isArray(data)) {
        return Buffer.concat(data).toString();
    }
    if (data instanceof ArrayBuffer) {
        return Buffer.from(data).toString();
    }
    return String(data);
}

export async function GET() {
    // Opt out of static prerendering when Cache Components are enabled.
    await connection();

    try {
        return await experimental_upgradeWebSocket((ws) => {
            // Register listeners synchronously so an immediate `hello` is not dropped.
            registerLiveConnection(ws);

            ws.on("message", (data: WebSocketData) => {
                void handleLiveClientMessage(ws, toText(data));
            });

            const cleanup = () => unregisterLiveConnection(ws);
            ws.on("close", cleanup);
            ws.on("error", cleanup);
        });
    } catch (error) {
        // Missing Fluid compute / non-Vercel runtime → upgrade helper throws.
        // Clients fall back to REST polling; return a clear non-500 status.
        console.error("Live WebSocket upgrade unavailable:", error);
        return new Response(
            JSON.stringify({
                error: "WebSocket upgrade unavailable",
                hint: "Enable Fluid compute on this Vercel project (vercel.json: fluid=true).",
            }),
            {
                status: 501,
                headers: { "content-type": "application/json" },
            }
        );
    }
}
