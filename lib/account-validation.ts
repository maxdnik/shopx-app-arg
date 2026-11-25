// Same checksum and password policy as the web. The server validates again.
export function normalizeCuit(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function getCuitValidationError(value: unknown): string {
  const digits = normalizeCuit(value);
  if (!digits) return "Completá tu CUIT/CUIL para continuar.";
  if (digits.length !== 11) return "Ingresá tu CUIT/CUIL de 11 dígitos. El DNI no es suficiente.";
  const sum = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2].reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
  const remainder = sum % 11;
  const expected = remainder === 0 ? 0 : remainder === 1 ? 9 : 11 - remainder;
  return expected === Number(digits[10]) ? "" : "El CUIT/CUIL ingresado no parece válido. Revisá el número.";
}

export function validatePassword(password: string) {
  const errors: string[] = [];
  if (password.length < 8) errors.push("Mínimo 8 caracteres");
  if (!/[A-Z]/.test(password)) errors.push("Al menos una mayúscula");
  if (!/[a-z]/.test(password)) errors.push("Al menos una minúscula");
  if (!/[0-9]/.test(password)) errors.push("Al menos un número");
  return { valid: errors.length === 0, errors };
}

export function isValidAccountEmail(value: string) {
  const email = value.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
