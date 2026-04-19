import { Receipt } from "lucide-react";
import { PlaceholderPage } from "@/components/shared";

export function ExpensesPage() {
  return (
    <PlaceholderPage
      title="Ausgaben"
      description="Geschäftsausgaben mit Kategorisierung und Belegverknüpfung. Wird in Modul 04 implementiert."
      icon={Receipt}
    />
  );
}
