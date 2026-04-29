import { Camera } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PLATFORM_LIMITS } from '../../constants';
import {
  calculateCompleteness,
  type ListingDetail,
  type ListingImageWithFile,
} from '../../listingsService';
import { resolveListingForPlatform } from '../../utils';
import { PreviewDiagnostics } from './PreviewDiagnostics';
import {
  formatCurrency,
  getCompletenessHints,
  isImageForPlatform,
  truncateText,
} from './previewUtils';

interface EtsyPreviewProps {
  listing: ListingDetail;
  images: ListingImageWithFile[];
  isLoadingImages: boolean;
}

export function EtsyPreview({ listing, images, isLoadingImages }: EtsyPreviewProps) {
  const override = listing.overrides.find((entry) => entry.platform === 'etsy') ?? null;
  const resolved = resolveListingForPlatform(listing, override, 'etsy');
  const mainImage = images.find((image) => isImageForPlatform(image, 'etsy')) ?? images[0] ?? null;
  const completeness = calculateCompleteness(
    { ...listing, imageCount: images.filter((image) => isImageForPlatform(image, 'etsy')).length },
    'etsy',
  );
  const hints = getCompletenessHints(listing, 'etsy', completeness);
  const description =
    resolved.shortDescription ??
    truncateText(resolved.longDescription ?? resolved.description, 200);
  const titleLimit = PLATFORM_LIMITS.etsy.maxTitleLength;
  const tagLimit = PLATFORM_LIMITS.etsy.maxTagCount;

  return (
    <div className="space-y-5">
      <div className="grid gap-6 rounded-lg border border-border-subtle bg-bg-elevated p-5 dark:border-transparent lg:grid-cols-[minmax(280px,1fr)_minmax(320px,0.9fr)]">
        <div className="flex min-h-80 items-center justify-center overflow-hidden rounded-md bg-bg-secondary">
          {isLoadingImages ? (
            <span className="text-sm text-text-muted">Bild wird geladen...</span>
          ) : mainImage?.file_path ? (
            <img
              src={mainImage.file_path}
              alt={mainImage.alt_text ?? resolved.title}
              className="h-full max-h-[440px] w-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-text-muted">
              <Camera size={34} />
              <span className="text-sm">Kein Hauptbild</span>
            </div>
          )}
        </div>

        <section className="space-y-4">
          <div>
            <p className="mb-2 text-sm text-text-secondary">PolyGrid Studio</p>
            <h2 className="text-2xl font-semibold leading-tight text-text-primary">
              {resolved.title}
            </h2>
            <p className="mt-3 text-2xl font-semibold text-text-primary">
              {formatCurrency(resolved.price)}
            </p>
          </div>

          <p className="whitespace-pre-wrap text-sm leading-6 text-text-secondary">
            {description || 'Keine Beschreibung hinterlegt.'}
          </p>

          <div className="flex flex-wrap gap-1.5">
            {resolved.tags.slice(0, tagLimit).map((tag) => (
              <Badge key={tag} variant="outline" className="bg-bg-primary text-text-secondary">
                {tag}
              </Badge>
            ))}
            {resolved.tags.length === 0 && (
              <span className="text-sm text-text-muted">Keine Tags hinterlegt.</span>
            )}
          </div>
        </section>
      </div>

      <PreviewDiagnostics
        completeness={completeness}
        hints={hints}
        counters={[
          {
            label: 'Titel',
            value: `${resolved.title.length}/${titleLimit}`,
            isOverLimit: resolved.title.length > titleLimit,
          },
          {
            label: 'Tags',
            value: `${resolved.tags.length}/${tagLimit}`,
            isOverLimit: resolved.tags.length > tagLimit,
          },
        ]}
      />
    </div>
  );
}
