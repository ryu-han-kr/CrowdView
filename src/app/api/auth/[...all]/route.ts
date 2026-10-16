import { toNextJsHandler } from "better-auth/next-js";
import { auth, authEnabled } from "@/lib/auth";

const handler = toNextJsHandler(auth);
const off = () => new Response("auth disabled", { status: 404 });

export const GET = authEnabled ? handler.GET : off;
export const POST = authEnabled ? handler.POST : off;
