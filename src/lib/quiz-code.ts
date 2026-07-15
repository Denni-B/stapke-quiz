const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateQuizCode(length = 6): string {
  let code = "";

  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * CODE_CHARS.length);
    code += CODE_CHARS[randomIndex];
  }

  return code;
}

export function normalizeQuizCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
