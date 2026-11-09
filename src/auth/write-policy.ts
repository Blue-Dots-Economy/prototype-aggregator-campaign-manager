export function assertWritableRole(role: string | null | undefined) {
  if (!role || role === "jfc_readonly") throw new Error("This account is read-only.");
}
