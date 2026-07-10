import { createRoute, redirect } from '@tanstack/react-router';
import { rootRoute } from './routes/__root';
import { validateOrdersSearch } from '@/features/orders/searchParams';
import { validateExpensesSearch } from '@/features/expenses/searchParams';
import { validateTasksSearch } from '@/features/tasks/searchParams';
import { validateListingsSearch } from '@/features/listings/searchParams';
import { validateWebsitesSearch } from '@/features/websites/searchParams';
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
import { WebsitesPage } from '@/features/websites';
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
  validateSearch: (search: Record<string, unknown>): { tab?: string } =>
    typeof search.tab === 'string' ? { tab: search.tab } : {},
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
  validateSearch: validateExpensesSearch,
});

const ordersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders',
  component: OrdersPage,
  validateSearch: validateOrdersSearch,
});

const listingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/listings',
  component: ListingsPage,
  validateSearch: validateListingsSearch,
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
  validateSearch: validateTasksSearch,
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

const websitesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/websites',
  component: WebsitesPage,
  validateSearch: validateWebsitesSearch,
});

const aiRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ai',
  component: AIAssistantPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  beforeLoad: () => {
    throw redirect({ to: '/settings/$tab', params: { tab: 'general' } });
  },
});

const settingsTabRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/$tab',
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
  websitesRoute,
  aiRoute,
  settingsRoute,
  settingsTabRoute,
]);
