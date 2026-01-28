import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

export type GovernXOneConfig = {
    apiKey: string;
    projectId: string;
    endpoint?: string;
};

export type ResolvedGovernXOneConfig = GovernXOneConfig & {
    source: "profile" | "env";
};

export async function getUserGovernXOneCredentials(userId: string): Promise<GovernXOneConfig | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            governxoneApiKey: true,
            governxoneProjectId: true,
            governxoneEndpoint: true,
        },
    });

    if (!user?.governxoneApiKey || !user.governxoneProjectId) {
        return null;
    }

    return {
        apiKey: decryptSecret(user.governxoneApiKey),
        projectId: user.governxoneProjectId,
        ...(user.governxoneEndpoint ? { endpoint: user.governxoneEndpoint } : {}),
    };
}

export async function saveUserGovernXOneCredentials(
    userId: string,
    input: { apiKey?: string; projectId?: string; endpoint?: string; clear?: boolean }
): Promise<void> {
    if (input.clear) {
        await prisma.user.update({
            where: { id: userId },
            data: {
                governxoneApiKey: null,
                governxoneProjectId: null,
                governxoneEndpoint: null,
            },
        });
        return;
    }

    const existing = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            governxoneApiKey: true,
            governxoneProjectId: true,
            governxoneEndpoint: true,
        },
    });

    const projectId = input.projectId?.trim() || existing?.governxoneProjectId || "";
    const apiKey = input.apiKey?.trim();
    const endpoint =
        input.endpoint !== undefined
            ? input.endpoint.trim() || null
            : existing?.governxoneEndpoint ?? null;

    if (!projectId || (!apiKey && !existing?.governxoneApiKey)) {
        throw new Error("Both GovernXOne API key and project ID are required");
    }

    await prisma.user.update({
        where: { id: userId },
        data: {
            governxoneProjectId: projectId,
            governxoneEndpoint: endpoint,
            ...(apiKey ? { governxoneApiKey: encryptSecret(apiKey) } : {}),
        },
    });
}

export async function getUserGovernXOneProfile(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            governxoneApiKey: true,
            governxoneProjectId: true,
            governxoneEndpoint: true,
        },
    });

    if (!user) {
        return {
            projectId: null,
            endpoint: null,
            hasApiKey: false,
            apiKey: null,
        };
    }

    const hasApiKey = Boolean(user.governxoneApiKey);
    const apiKey = hasApiKey && user.governxoneApiKey ? decryptSecret(user.governxoneApiKey) : null;

    return {
        projectId: user.governxoneProjectId,
        endpoint: user.governxoneEndpoint,
        hasApiKey,
        apiKey,
    };
}

function getEnvGovernXOneConfig(): GovernXOneConfig | null {
    const apiKey = process.env.GOVERNXONE_API_KEY?.trim();
    const projectId = process.env.GOVERNXONE_PROJECT_ID?.trim();
    const endpoint = process.env.GOVERNXONE_ENDPOINT?.trim();

    if (!apiKey || !projectId) {
        return null;
    }

    return {
        apiKey,
        projectId,
        ...(endpoint ? { endpoint } : {}),
    };
}

export async function resolveGovernXOneConfig(userId?: string): Promise<ResolvedGovernXOneConfig | null> {
    if (userId) {
        const profileConfig = await getUserGovernXOneCredentials(userId);
        if (profileConfig) {
            if (!profileConfig.endpoint) {
                const envEndpoint = process.env.GOVERNXONE_ENDPOINT?.trim();
                if (envEndpoint) {
                    return { ...profileConfig, endpoint: envEndpoint, source: "profile" };
                }
            }
            return { ...profileConfig, source: "profile" };
        }
    }

    const envConfig = getEnvGovernXOneConfig();
    return envConfig ? { ...envConfig, source: "env" } : null;
}
