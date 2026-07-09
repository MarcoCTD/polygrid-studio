export {
  createClient,
  getClientById,
  getClients,
  parseCredentials,
  softDeleteClient,
  updateClient,
} from './clientsService';
export {
  billWebsiteProject,
  createWebsiteProject,
  getWebsiteProjectById,
  getWebsiteProjects,
  softDeleteWebsiteProject,
  updateWebsiteProject,
} from './projectsService';
export {
  calculateRecurringTotals,
  createWebsiteService,
  getWebsiteServiceById,
  getWebsiteServices,
  normalizeToMonthly,
  softDeleteWebsiteService,
  updateWebsiteService,
  type WebsiteRecurringTotals,
} from './websiteServicesService';
