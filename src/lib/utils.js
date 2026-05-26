/** Join class names (minimal cn helper for v1.5 UI). */
export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}
