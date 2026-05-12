import type { EbayTradingPictureResponse } from './ebay-types';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function textContent(document: Document, tagName: string): string | null {
  return document.getElementsByTagName(tagName).item(0)?.textContent?.trim() ?? null;
}

export function buildUploadSiteHostedPicturesXml(params: {
  accessToken: string;
  pictureName: string;
}): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">',
    '<RequesterCredentials>',
    `<eBayAuthToken>${escapeXml(params.accessToken)}</eBayAuthToken>`,
    '</RequesterCredentials>',
    `<PictureName>${escapeXml(params.pictureName)}</PictureName>`,
    '</UploadSiteHostedPicturesRequest>',
  ].join('');
}

export function parseUploadSiteHostedPicturesResponse(xml: string): EbayTradingPictureResponse {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const parserError = textContent(document, 'parsererror');
  if (parserError) {
    throw new Error(`eBay Trading API XML konnte nicht gelesen werden: ${parserError}`);
  }

  const ack = textContent(document, 'Ack');
  const error = textContent(document, 'LongMessage') ?? textContent(document, 'ShortMessage');
  if (ack && ack !== 'Success' && ack !== 'Warning') {
    throw new Error(error ?? `eBay Trading API meldet Ack=${ack}.`);
  }

  const fullUrl = textContent(document, 'FullURL');
  if (!fullUrl) {
    throw new Error('eBay Bild-Upload lieferte keine FullURL zurück.');
  }

  return {
    fullUrl,
    pictureSet: textContent(document, 'PictureSet') ?? undefined,
    pictureName: textContent(document, 'PictureName') ?? undefined,
    ack: ack ?? undefined,
  };
}
