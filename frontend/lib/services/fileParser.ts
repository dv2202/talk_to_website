import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";

export async function parsePDF(filePath: string): Promise<string> {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text.trim();
    } catch (error) {
        throw new Error(
            `Failed to parse PDF: ${error instanceof Error ? error.message : "Unknown error"}`
        );
    } finally {
        // Clean up uploaded file
        try {
            fs.unlinkSync(filePath);
        } catch { }
    }
}

export async function parseTXT(filePath: string): Promise<string> {
    try {
        const content = fs.readFileSync(filePath, "utf-8");
        return content.trim();
    } catch (error) {
        throw new Error(
            `Failed to parse TXT: ${error instanceof Error ? error.message : "Unknown error"}`
        );
    } finally {
        // Clean up uploaded file
        try {
            fs.unlinkSync(filePath);
        } catch { }
    }
}

export function getFileExtension(filename: string): string {
    return path.extname(filename).toLowerCase().replace(".", "");
}
