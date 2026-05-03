import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BanktransaktionenPanel, BeleguebersichtPanel, EuerExportPanel } from './components';

export function FinancePage() {
  return (
    <div className="flex h-full flex-col bg-bg-primary">
      <header className="border-b border-border-subtle px-6 py-4">
        <h1 className="text-2xl font-semibold text-text-primary">Finanzen</h1>
        <p className="mt-1 text-sm text-text-secondary">
          EÜR-Export, Banktransaktionen und Belegübersicht für Modul 08.
        </p>
      </header>

      <Tabs defaultValue="euer" className="flex flex-1 flex-col overflow-hidden">
        <TabsList variant="line" className="w-full justify-start px-6 pt-3">
          <TabsTrigger value="euer">EÜR-Export</TabsTrigger>
          <TabsTrigger value="bank">Banktransaktionen</TabsTrigger>
          <TabsTrigger value="receipts">Belegübersicht</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto p-6">
          <TabsContent value="euer">
            <EuerExportPanel />
          </TabsContent>
          <TabsContent value="bank">
            <BanktransaktionenPanel />
          </TabsContent>
          <TabsContent value="receipts">
            <BeleguebersichtPanel />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
