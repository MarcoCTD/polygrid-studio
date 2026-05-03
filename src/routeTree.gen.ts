import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './routes/__root';
import { DashboardPage } from '@/features/dashboard';
import { ProductsPage } from '@/features/products';
import { ProductEditPage } from '@/features/products/components/ProductEditPage';
import { TrashPage } from '@/features/products/components/TrashPage';
import { ExpensesPage } from '@/features/expenses';
import { OrdersPage } from '@/features/orders';
import { ListingEditorPage, ListingsPage } from '@/features/listings';
import { TemplatesPage } from '@/features/templates';
import { FilesPage } from '@/features/files';
import { TasksPage } from '@/features/tasks';
import { AnalyticsPage } from '@/features/analytics';
import { FinancePage } from '@/features/finance';
import { AIAssistantPage } from '@/features/ai-assistant';
import { SettingsPage } from '@/features/settings';

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
});

const productsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/products',
  component: ProductsPage,
});

const productEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/products/$productId',
  component: ProductEditPage,
});

const productsTrashRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/products/trash',
  component: TrashPage,
});

const expensesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/expenses',
  component: ExpensesPage,
});

const ordersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders',
  component: OrdersPage,
});

const listingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/listings',
  component: ListingsPage,
});

const listingEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/listings/$listingId',
  component: ListingEditorPage,
});

const templatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/templates',
  component: TemplatesPage,
});

const filesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/files',
  component: FilesPage,
});

const tasksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tasks',
  component: TasksPage,
});

const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/analytics',
  component: AnalyticsPage,
});

const financeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/finance',
  component: FinancePage,
});

const aiRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ai',
  component: AIAssistantPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
  productsRoute,
  productsTrashRoute,
  productEditRoute,
  expensesRoute,
  ordersRoute,
  listingsRoute,
  listingEditRoute,
  templatesRoute,
  filesRoute,
  tasksRoute,
  analyticsRoute,
  financeRoute,
  aiRoute,
  settingsRoute,
]);
