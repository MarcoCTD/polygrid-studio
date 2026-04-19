import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./routes/__root";
import { DashboardPage } from "@/features/dashboard";
import { ProductsPage } from "@/features/products";
import { ExpensesPage } from "@/features/expenses";
import { OrdersPage } from "@/features/orders";
import { ListingsPage } from "@/features/listings";
import { TemplatesPage } from "@/features/templates";
import { FilesPage } from "@/features/files";
import { TasksPage } from "@/features/tasks";
import { AnalyticsPage } from "@/features/analytics";
import { AIAssistantPage } from "@/features/ai-assistant";
import { SettingsPage } from "@/features/settings";

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});

const productsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/products",
  component: ProductsPage,
});

const expensesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/expenses",
  component: ExpensesPage,
});

const ordersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/orders",
  component: OrdersPage,
});

const listingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/listings",
  component: ListingsPage,
});

const templatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/templates",
  component: TemplatesPage,
});

const filesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/files",
  component: FilesPage,
});

const tasksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tasks",
  component: TasksPage,
});

const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/analytics",
  component: AnalyticsPage,
});

const aiRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/ai",
  component: AIAssistantPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
  productsRoute,
  expensesRoute,
  ordersRoute,
  listingsRoute,
  templatesRoute,
  filesRoute,
  tasksRoute,
  analyticsRoute,
  aiRoute,
  settingsRoute,
]);
