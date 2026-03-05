const PLATFORM_PATTERNS: [RegExp, string][] = [
  [/^(?:www\.)?(?:x\.com|twitter\.com)/, "tweet"],
  [/^(?:www\.)?instagram\.com/, "instagram"],
  [/^(?:www\.)?tiktok\.com/, "tiktok"],
  [/^(?:www\.)?(?:youtube\.com|youtu\.be)/, "youtube"],
  [/^(?:www\.)?linkedin\.com/, "linkedin"],
];

const EXTENSION_MAP: Record<string, string> = {
  pdf: "pdf",
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  avif: "image",
  mp4: "video",
  mov: "video",
  webm: "video",
  avi: "video",
  mkv: "video",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  flac: "audio",
  aac: "audio",
  m4a: "audio",
};

const MIME_TO_TYPE: Record<string, string> = {
  image: "image",
  video: "video",
  audio: "audio",
  "application/pdf": "pdf",
};

export function detectTypeFromUrl(url: string): string {
  let hostname: string;
  let pathname: string;
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname;
    pathname = parsed.pathname;
  } catch {
    return "link";
  }

  for (const [pattern, type] of PLATFORM_PATTERNS) {
    if (pattern.test(hostname)) return type;
  }

  const ext = pathname.split(".").pop()?.toLowerCase() ?? "";
  if (ext in EXTENSION_MAP) return EXTENSION_MAP[ext]!

  return "link";
}

export function detectTypeFromMime(mimeType: string): string {
  if (mimeType === "application/pdf") return "pdf";
  const prefix = mimeType.split("/")[0] ?? "";
  return MIME_TO_TYPE[prefix] ?? "other";
}
