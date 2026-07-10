import { Globe, Plus } from 'lucide-react';
import type { Command } from '@/stores';

export const WEBSITE_COMMAND_IDS = [
  'websites.new-project',
  'websites.new-client',
  'websites.new-service',
  'websites.open',
];

interface CreateWebsiteCommandsOptions {
  onNewProject: () => void;
  onNewClient: () => void;
  onNewService: () => void;
  onNavigateWebsites: () => void;
}

export function createWebsiteCommands({
  onNewProject,
  onNewClient,
  onNewService,
  onNavigateWebsites,
}: CreateWebsiteCommandsOptions): Command[] {
  return [
    {
      id: 'websites.new-project',
      label: 'Neues Website-Projekt',
      icon: Plus,
      category: 'action',
      action: onNewProject,
    },
    {
      id: 'websites.new-client',
      label: 'Neuer Website-Kunde',
      icon: Plus,
      category: 'action',
      action: onNewClient,
    },
    {
      id: 'websites.new-service',
      label: 'Neuer laufender Posten',
      icon: Plus,
      category: 'action',
      action: onNewService,
    },
    {
      id: 'websites.open',
      label: 'Zu Websites',
      icon: Globe,
      category: 'navigation',
      action: onNavigateWebsites,
    },
  ];
}
