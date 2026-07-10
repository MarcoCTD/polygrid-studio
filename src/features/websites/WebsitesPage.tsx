import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearch } from '@tanstack/react-router';
import { FolderKanban, Plus, RefreshCw, TrendingDown, TrendingUp, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatEUR } from '@/features/products/utils';
import { useUIStore } from '@/stores';
import { cn } from '@/lib/utils';
import { createWebsiteCommands, WEBSITE_COMMAND_IDS } from './commands';
import {
  ClientDetailPanel,
  ClientsTab,
  NewClientModal,
  NewProjectModal,
  NewServiceModal,
  ProjectDetailPanel,
  ProjectsTab,
  ServiceDetailPanel,
  ServicesTab,
} from './components';
import { notifyWebsiteRecurringResult } from './notifications';
import type { WebsitesSearch, WebsitesTab } from './searchParams';
import type { ClientListItem, WebsiteProjectListItem, WebsiteServiceListItem } from './schemas';
import {
  calculateRecurringTotals,
  getClients,
  getWebsiteProjects,
  getWebsiteServices,
  runWebsiteRecurringEngine,
} from './services';

const TAB_LABELS: Record<WebsitesTab, string> = {
  projects: 'Projekte',
  clients: 'Kunden',
  services: 'Laufende Posten',
};

function isoDaysAhead(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

interface KpiCardProps {
  label: string;
  value: string;
  icon: typeof Wallet;
  tone?: 'default' | 'positive' | 'negative';
}

function KpiCard({ label, value, icon: Icon, tone = 'default' }: KpiCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-bg-elevated p-4">
      <div className="rounded-lg bg-pg-accent-subtle p-2">
        <Icon className="size-5 text-pg-accent" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-text-secondary">{label}</p>
        <p
          className={cn(
            'truncate text-lg font-semibold tabular-nums',
            tone === 'positive' && 'text-emerald-700 dark:text-emerald-400',
            tone === 'negative' && 'text-red-700 dark:text-red-400',
            tone === 'default' && 'text-text-primary',
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

export function WebsitesPage() {
  const router = useRouter();
  const search = useSearch({ strict: false }) as WebsitesSearch;
  const registerCommands = useUIStore((state) => state.registerCommands);
  const unregisterCommands = useUIStore((state) => state.unregisterCommands);
  const openDetailPanel = useUIStore((state) => state.openDetailPanel);

  // Tab und Filter sind vollständig URL-getrieben (Smart-Action-Navigation
  // und Tab-Wechsel laufen über router.navigate).
  const activeTab: WebsitesTab = search.tab ?? 'projects';
  const filter = search.filter;
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [projects, setProjects] = useState<WebsiteProjectListItem[]>([]);
  const [services, setServices] = useState<WebsiteServiceListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newServiceOpen, setNewServiceOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [clientList, projectList, serviceList] = await Promise.all([
        getClients(),
        getWebsiteProjects(),
        getWebsiteServices(),
      ]);
      setClients(clientList);
      setProjects(projectList);
      setServices(serviceList);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Website-Daten konnten nicht geladen werden',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Laden aus der lokalen SQLite ist der externe Synchronisationspunkt der Seite.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const commands = createWebsiteCommands({
      onNewProject: () => setNewProjectOpen(true),
      onNewClient: () => setNewClientOpen(true),
      onNewService: () => setNewServiceOpen(true),
      onNavigateWebsites: () => void router.navigate({ to: '/websites' }),
    });
    registerCommands(commands);
    return () => unregisterCommands(WEBSITE_COMMAND_IDS);
  }, [registerCommands, router, unregisterCommands]);

  const totals = useMemo(() => calculateRecurringTotals(services), [services]);
  const activeProjectCount = useMemo(
    () => projects.filter((project) => !['live', 'archived'].includes(project.status)).length,
    [projects],
  );

  const filteredProjects = useMemo(() => {
    if (filter !== 'deadline') return projects;
    const limit = isoDaysAhead(7);
    return projects.filter(
      (project) =>
        ['in_progress', 'review'].includes(project.status) &&
        project.deadline !== null &&
        project.deadline <= limit,
    );
  }, [filter, projects]);

  const filteredServices = useMemo(() => {
    if (filter !== 'expiring') return services;
    const limit = isoDaysAhead(30);
    return services.filter(
      (service) =>
        service.type === 'domain' &&
        service.active &&
        service.expires_at !== null &&
        service.expires_at <= limit,
    );
  }, [filter, services]);

  function switchTab(tab: WebsitesTab) {
    void router.navigate({ to: '/websites', search: { tab } });
  }

  function clearFilter() {
    void router.navigate({ to: '/websites', search: { tab: activeTab } });
  }

  function openProject(project: WebsiteProjectListItem) {
    openDetailPanel(
      <ProjectDetailPanel project={project} clients={clients} onChanged={() => void loadData()} />,
    );
  }

  function openClient(client: ClientListItem) {
    openDetailPanel(
      <ClientDetailPanel
        client={client}
        projects={projects.filter((project) => project.client_id === client.id)}
        onChanged={() => void loadData()}
        onOpenProject={openProject}
      />,
    );
  }

  function openService(service: WebsiteServiceListItem) {
    openDetailPanel(
      <ServiceDetailPanel
        service={service}
        clients={clients}
        projects={projects}
        onChanged={() => void loadData()}
      />,
    );
  }

  async function handleCheckNow() {
    setIsChecking(true);
    try {
      const result = await runWebsiteRecurringEngine();
      notifyWebsiteRecurringResult(result);
      if (
        result.expensesCreated === 0 &&
        result.ordersCreated === 0 &&
        result.cappedLabels.length === 0 &&
        result.errors.length === 0
      ) {
        toast.info('Keine fälligen Posten – alles aktuell.');
      }
      await loadData();
    } finally {
      setIsChecking(false);
    }
  }

  const newButton =
    activeTab === 'projects' ? (
      <Button size="sm" className="gap-2" onClick={() => setNewProjectOpen(true)}>
        <Plus className="size-4" />
        Neues Projekt
      </Button>
    ) : activeTab === 'clients' ? (
      <Button size="sm" className="gap-2" onClick={() => setNewClientOpen(true)}>
        <Plus className="size-4" />
        Neuer Kunde
      </Button>
    ) : (
      <Button size="sm" className="gap-2" onClick={() => setNewServiceOpen(true)}>
        <Plus className="size-4" />
        Neuer Posten
      </Button>
    );

  return (
    <div className="flex h-full flex-col bg-bg-primary">
      <header className="border-b border-border-subtle px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Websites</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Kunden, Website-Projekte und laufende Posten (Hosting, Domains, Wartung).
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'services' && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={isChecking}
                onClick={() => void handleCheckNow()}
              >
                <RefreshCw className={cn('size-4', isChecking && 'animate-spin')} />
                Jetzt prüfen
              </Button>
            )}
            {newButton}
          </div>
        </div>

        {/* Kennzahlen: monatlich normalisiert (yearly / 12) */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="website-kpis">
          <KpiCard label="Aktive Projekte" value={String(activeProjectCount)} icon={FolderKanban} />
          <KpiCard
            label="Wiederkehrende Einnahmen / Monat"
            value={formatEUR(totals.monthlyIncome)}
            icon={TrendingUp}
            tone="positive"
          />
          <KpiCard
            label="Wiederkehrende Kosten / Monat"
            value={formatEUR(totals.monthlyCost)}
            icon={TrendingDown}
            tone="negative"
          />
          <KpiCard
            label="Saldo / Monat"
            value={formatEUR(totals.monthlyBalance)}
            icon={Wallet}
            tone={totals.monthlyBalance >= 0 ? 'positive' : 'negative'}
          />
        </div>
      </header>

      <div className="flex items-center gap-3 border-b border-border-subtle bg-bg-secondary px-6 py-2">
        <Tabs value={activeTab} onValueChange={(value) => switchTab(value as WebsitesTab)}>
          <TabsList>
            {(Object.keys(TAB_LABELS) as WebsitesTab[]).map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {TAB_LABELS[tab]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {filter && (
          <Button
            variant="secondary"
            size="sm"
            className="gap-1"
            aria-label="Filter entfernen"
            onClick={clearFilter}
          >
            {filter === 'expiring' ? 'Ablaufende Domains' : 'Nahe Deadlines'}
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      {activeTab === 'projects' && (
        <ProjectsTab
          projects={filteredProjects}
          isLoading={isLoading}
          onOpenProject={openProject}
          onChanged={() => void loadData()}
        />
      )}
      {activeTab === 'clients' && (
        <ClientsTab
          clients={clients}
          isLoading={isLoading}
          onOpenClient={openClient}
          onChanged={() => void loadData()}
        />
      )}
      {activeTab === 'services' && (
        <ServicesTab
          services={filteredServices}
          isLoading={isLoading}
          onOpenService={openService}
          onChanged={() => void loadData()}
        />
      )}

      <NewClientModal
        open={newClientOpen}
        onOpenChange={setNewClientOpen}
        onCreated={() => void loadData()}
      />
      <NewProjectModal
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        clients={clients}
        onCreated={() => void loadData()}
      />
      <NewServiceModal
        open={newServiceOpen}
        onOpenChange={setNewServiceOpen}
        clients={clients}
        projects={projects}
        onCreated={() => void loadData()}
      />
    </div>
  );
}
