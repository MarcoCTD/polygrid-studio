import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogMedia,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';
import type { Product } from '../schema';
import { LICENSE_TYPE_LABELS, LICENSE_RISK_LABELS } from '../labels';

interface LicenseWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Pick<Product, 'license_type' | 'license_risk' | 'license_source'>;
  onConfirm: () => void;
  onCancel: () => void;
}

export function LicenseWarningDialog({
  open,
  onOpenChange,
  product,
  onConfirm,
  onCancel,
}: LicenseWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-warning-subtle">
            <AlertTriangle size={24} className="text-[var(--accent-warning)]" />
          </AlertDialogMedia>
          <AlertDialogTitle>Lizenz-Risiko prüfen</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="block">
              Dieses Produkt hat einen ungeklärten oder riskanten Lizenzstatus:
            </span>
            <span className="mt-2 block text-sm">
              <span className="block">
                Lizenztyp:{' '}
                <strong>
                  {product.license_type
                    ? (LICENSE_TYPE_LABELS[product.license_type] ?? product.license_type)
                    : 'nicht gesetzt'}
                </strong>
              </span>
              <span className="block">
                Risiko:{' '}
                <strong>
                  {product.license_risk
                    ? (LICENSE_RISK_LABELS[product.license_risk] ?? product.license_risk)
                    : 'nicht bewertet'}
                </strong>
              </span>
              <span className="block">
                Quelle: <strong>{product.license_source || 'unbekannt'}</strong>
              </span>
            </span>
            <span className="mt-2 block">Bist du sicher, dass du es online stellen willst?</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Trotzdem online stellen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
