import { z } from "zod";
import { aiService } from "../ai-service";

const LISTING_STYLE_RULES = `
Stilregeln für Listing-Texte:
- Präzise, clean, sachlich-hochwertig
- KEINE Emojis
- KEINE Gedankenstriche als Stilmittel
- KEINE KI-Floskeln: "Entdecke", "Erlebe", "Perfekt für", "Must-have", "Eyecatcher"
- KEINE Superlative ohne Substanz
- KEINE Fragen im Beschreibungstext
- BEVORZUGT: Konkrete Maße, Materialangaben, Funktionsbeschreibung
- Sprache: Deutsch, sachlich-professionell
`.trim();

export interface ListingGenerationInput {
  productName: string;
  category: string;
  material: string;
  description?: string;
  platform: string;
}

export const GeneratedListingSchema = z.object({
  title: z.string(),
  shortDescription: z.string(),
  longDescription: z.string(),
  bulletPoints: z.array(z.string()),
  tags: z.array(z.string()),
});

export type GeneratedListing = z.infer<typeof GeneratedListingSchema>;

export async function generateListingText(
  input: ListingGenerationInput
): Promise<string> {
  const prompt = `
${LISTING_STYLE_RULES}

Erstelle einen Listing-Text für folgendes 3D-Druck-Produkt:
- Produktname: ${input.productName}
- Kategorie: ${input.category}
- Material: ${input.material}
- Plattform: ${input.platform}
${input.description ? `- Beschreibung: ${input.description}` : ""}

Erstelle:
1. Einen Listing-Titel (max. 140 Zeichen)
2. Eine Kurzbeschreibung (2-3 Sätze)
3. Eine ausführliche Beschreibung (3-5 Absätze)
4. 5 Bullet Points mit konkreten Produkteigenschaften
5. 10 relevante Tags/Suchbegriffe

Formatiere die Ausgabe klar strukturiert mit Überschriften.
`.trim();

  const response = await aiService.generateText(
    prompt,
    "ListingAssistant",
    "generateListingText",
    { temperature: 0.7 }
  );

  return response.text;
}
