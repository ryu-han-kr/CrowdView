"use client";

import { createAuthClient } from "better-auth/react";

// 같은 사이트의 /api/auth 를 쓴다
export const authClient = createAuthClient();
export const { useSession, signIn, signOut } = authClient;
