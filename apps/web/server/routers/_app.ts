import { createRouter } from "../trpc";
import { authRouter } from "./auth";
import { clientsRouter } from "./clients";
import { patientsRouter } from "./patients";
import { appointmentsRouter } from "./appointments";
import { recordsRouter } from "./records";
import { billingRouter } from "./billing";
import { dashboardRouter } from "./dashboard";
import { whiteboardRouter } from "./whiteboard";
import { reportsRouter } from "./reports";
import { portalRouter } from "./portal";
import { settingsRouter } from "./settings";
import { communicationsRouter } from "./communications";
import { inventoryRouter } from "./inventory";
import { dataRouter } from "./data";
import { aiRouter } from "./ai";
import { webhooksRouter } from "./webhooks";

export const appRouter = createRouter({
  auth: authRouter,
  clients: clientsRouter,
  patients: patientsRouter,
  appointments: appointmentsRouter,
  records: recordsRouter,
  billing: billingRouter,
  dashboard: dashboardRouter,
  whiteboard: whiteboardRouter,
  reports: reportsRouter,
  portal: portalRouter,
  settings: settingsRouter,
  communications: communicationsRouter,
  inventory: inventoryRouter,
  data: dataRouter,
  ai: aiRouter,
  webhooks: webhooksRouter,
});

export type AppRouter = typeof appRouter;
