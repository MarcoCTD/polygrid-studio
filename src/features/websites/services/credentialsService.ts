/**
 * Zugangsdaten-Secrets (Modul 16) über die bestehende Keychain-Infrastruktur
 * (Rust-Commands keychain_set/get/delete, Service "polygrid-studio" – exakt
 * wie die API-Keys aus Modul 06/11). Account-Schema: polygrid_credential_{id}.
 *
 * WICHTIG: Secrets erscheinen niemals in DB, Logs oder Exporten. Dieses Modul
 * loggt deshalb ausschließlich Fehlermeldungen ohne Werte.
 */
import { invoke } from '@tauri-apps/api/core';

const KEYCHAIN_SERVICE = 'polygrid-studio';

export function credentialKeychainKey(credentialId: string): string {
  return `polygrid_credential_${credentialId}`;
}

export async function setCredentialSecret(credentialId: string, secret: string): Promise<void> {
  try {
    await invoke('keychain_set', {
      service: KEYCHAIN_SERVICE,
      key: credentialKeychainKey(credentialId),
      value: secret,
    });
  } catch (error) {
    throw new Error(
      `Secret konnte nicht im Keychain gespeichert werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getCredentialSecret(credentialId: string): Promise<string | null> {
  try {
    return await invoke<string | null>('keychain_get', {
      service: KEYCHAIN_SERVICE,
      key: credentialKeychainKey(credentialId),
    });
  } catch (error) {
    throw new Error(
      `Secret konnte nicht aus dem Keychain gelesen werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function deleteCredentialSecret(credentialId: string): Promise<void> {
  try {
    await invoke('keychain_delete', {
      service: KEYCHAIN_SERVICE,
      key: credentialKeychainKey(credentialId),
    });
  } catch (error) {
    throw new Error(
      `Secret konnte nicht aus dem Keychain gelöscht werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Kopiert das Secret in die Zwischenablage, ohne es anzuzeigen. */
export async function copyCredentialSecret(credentialId: string): Promise<void> {
  const secret = await getCredentialSecret(credentialId);
  if (secret === null) {
    throw new Error('Kein Secret im Keychain hinterlegt.');
  }
  try {
    await navigator.clipboard.writeText(secret);
  } catch (error) {
    throw new Error(
      `Secret konnte nicht kopiert werden: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
