/** Only app-local paths are allowed as a post-sign-in destination. */
export function safeNextPath(value: string | null | undefined): string {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/";
}
