import { Globe, Plus, ReceiptText } from 'lucide-react';
import type { Command } from '@/stores';

export const WEBSITE_COMMAND_IDS = [
  'websites.new-project',
  'websites.new-client',
  'websites.new-service',
  'documents.new-quote',
  'documents.new-invoice',
  'websites.open',
];

interface CreateWebsiteCommandsOptions {
  onNewProject: () => void;
  onNewClient: () => void;
  onNewService: () => void;
  onNewQuote: () => void;
  onNewInvoice: () => void;
  onNavigateWebsites: () => void;
}

export function createWebsiteCommands({
  onNewProject,
  onNewClient,
  onNewService,
  onNewQuote,
  onNewInvoice,
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
      id: 'documents.new-quote',
      label: 'Neues Angebot',
      icon: ReceiptText,
      category: 'action',
      action: onNewQuote,
    },
    {
      id: 'documents.new-invoice',
      label: 'Neue Rechnung',
      icon: ReceiptText,
      category: 'action',
      action: onNewInvoice,
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
