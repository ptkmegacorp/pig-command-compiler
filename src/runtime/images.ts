import { promises as fs } from "node:fs";
import path from "node:path";

export interface PigImageAttachment {
  type: "image";
  data: string;
  mimeType: string;
  [key: string]: unknown;
}

export async function appendImagePath(
  images: PigImageAttachment[] | undefined,
  imagePath: string | undefined,
): Promise<PigImageAttachment[] | undefined> {
  if (!imagePath) return images;
  const data = await fs.readFile(imagePath, "base64");
  return [...(images ?? []), { type: "image", mimeType: mimeTypeForPath(imagePath), data }];
}

function mimeTypeForPath(imagePath: string): string {
  switch (path.extname(imagePath).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".png":
    default:
      return "image/png";
  }
}
