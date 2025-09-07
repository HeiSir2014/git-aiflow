/**
 * Utility for string sanitization
 */
export class StringUtil {
  static sanitizeName(name: string): string {
    return (name || "user")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-._]/g, "")
      .replace(/^-+|-+$/g, "") || "user";
  }

  static sanitizeBranch(branch: string): string {
    return (branch || "change")
      .toLowerCase()
      .replace(/[~^:?*\[\]\\@]/g, "-")
      .replace(/[\/\s]+/g, "-")
      .replace(/\.{2,}/g, ".")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "") || "change";
  }
}
