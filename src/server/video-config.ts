import 'server-only';

export function openrouterVideoKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  // Riusa la chiave immagini solo se è davvero configurata per OpenRouter.
  try { if (new URL(process.env.IMAGE_BASE_URL || '').origin === 'https://openrouter.ai') return process.env.IMAGE_API_KEY || ''; } catch { /* Non configurato. */ }
  return '';
}
export function videoConfig() {
  const duration = Number(process.env.VIDEO_DURATION_SECONDS || 4);
  return {
    enabled: process.env.VIDEO_ENABLED === 'true' && Boolean(openrouterVideoKey()),
    model: process.env.VIDEO_MODEL || 'google/veo-3.1-lite',
    duration: Number.isInteger(duration) && duration >= 1 && duration <= 15 ? duration : 4,
    resolution: process.env.VIDEO_RESOLUTION || '720p',
    aspectRatio: process.env.VIDEO_ASPECT_RATIO || '16:9',
  };
}
