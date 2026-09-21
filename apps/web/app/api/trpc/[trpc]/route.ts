import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { createTRPCContext } from "@/server/trpc";

/** Cold starts after a deploy can exceed the 10s default; Safari then shows "Load failed". */
export const maxDuration = 60;

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: ({ req }) => createTRPCContext({ req }),
  });
}

export { handler as GET, handler as POST };
