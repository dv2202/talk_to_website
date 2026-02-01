export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB
export const MAX_AVATAR_DIMENSION = 512;

const ALLOWED_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
]);

function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to read image"));
        };
        img.src = url;
    });
}

function canvasToBlob(
    canvas: HTMLCanvasElement,
    type: string,
    quality: number
): Promise<Blob | null> {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), type, quality);
    });
}

function replaceExtension(filename: string, ext: string): string {
    const base = filename.replace(/\.[^.]+$/, "") || "logo";
    return `${base}.${ext}`;
}

/**
 * Compresses a widget logo for upload.
 * - Rejects files over 2MB
 * - Downscales only when larger than needed for avatars (keeps sharp display quality)
 * - Re-encodes as high-quality WebP (or JPEG fallback) to shrink bytes without visible loss
 * - Leaves animated GIFs untouched (canvas would flatten them)
 */
export async function compressAvatarImage(file: File): Promise<File> {
    if (!ALLOWED_TYPES.has(file.type)) {
        throw new Error("Only JPEG, PNG, WebP, and GIF images are allowed");
    }

    if (file.size > MAX_AVATAR_BYTES) {
        throw new Error("Image must be 2MB or smaller");
    }

    // Keep GIFs as-is so animation is preserved
    if (file.type === "image/gif") {
        return file;
    }

    const image = await loadImage(file);
    const scale = Math.min(
        1,
        MAX_AVATAR_DIMENSION / Math.max(image.width, image.height)
    );
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Failed to process image");
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, width, height);

    // High quality (~visually lossless for avatar sizes); prefer WebP for smaller bytes
    const quality = 0.92;
    let blob = await canvasToBlob(canvas, "image/webp", quality);
    let mime = "image/webp";
    let ext = "webp";

    if (!blob) {
        blob = await canvasToBlob(canvas, "image/jpeg", quality);
        mime = "image/jpeg";
        ext = "jpg";
    }

    if (!blob) {
        throw new Error("Failed to compress image");
    }

    // Prefer compressed only when it actually shrinks; otherwise keep original
    if (blob.size >= file.size && scale === 1) {
        return file;
    }

    if (blob.size > MAX_AVATAR_BYTES) {
        throw new Error("Image must be 2MB or smaller");
    }

    return new File([blob], replaceExtension(file.name, ext), {
        type: mime,
        lastModified: Date.now(),
    });
}
