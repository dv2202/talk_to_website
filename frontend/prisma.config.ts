import { defineConfig } from "prisma/config";
import { config } from "dotenv";

config();

export default defineConfig({
    schema: "./prisma/schema.prisma",
    datasource: {
        // CLI (migrate/studio) needs a direct/session connection, not the transaction pooler.
        url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
});
