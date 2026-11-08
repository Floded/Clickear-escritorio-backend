import bcrypt from "bcryptjs";

import { prisma } from "../../prisma/client.js";
import { HttpError } from "../../shared/http-error.js";
import { signSession, type SessionUser } from "../../shared/session.js";
import type { LoginInput } from "./auth.dto.js";

// Hash de relleno para que un email inexistente tarde lo mismo que uno válido
let dummyHash: string | null = null;
async function getDummyHash(): Promise<string> {
  dummyHash ??= await bcrypt.hash("timing-equalizer", 10);
  return dummyHash;
}

export interface LoginResult {
  token: string;
  user: SessionUser;
}

async function login(input: LoginInput): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  const isValid = await bcrypt.compare(
    input.password,
    user?.passwordHash ?? (await getDummyHash()),
  );
  if (!user || !isValid) {
    throw new HttpError(401, "Credenciales incorrectas");
  }

  return {
    token: signSession({ sub: String(user.id), email: user.email, name: user.name }),
    user: { id: user.id, email: user.email, name: user.name },
  };
}

export const authService = { login };
