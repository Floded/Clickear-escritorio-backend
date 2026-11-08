import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(200, "La contraseña es muy larga")
    .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
    .regex(/[a-z]/, "Debe contener al menos una minúscula")
    .regex(/[0-9]/, "Debe contener al menos un número")
    .regex(/[^A-Za-z0-9]/, "Debe contener al menos un carácter especial"),
});

export type LoginInput = z.infer<typeof loginSchema>;
