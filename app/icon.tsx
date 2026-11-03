import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default async function Icon() {
  const image = await readFile(join(process.cwd(), "public/icons/studio-calendar-v2-512.png"));
  return new Response(new Uint8Array(image), { headers: { "Content-Type": contentType } });
}
