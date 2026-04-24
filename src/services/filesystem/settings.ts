import { getSetting, setSetting } from '@/services/database';

const ONEDRIVE_BASE_PATH_KEY = 'onedrive_base_path';

export async function getOneDriveBasePath(): Promise<string | null> {
  const value = await getSetting<string>(ONEDRIVE_BASE_PATH_KEY);
  if (!value || value.trim().length === 0) {
    return null;
  }
  return value;
}

export async function setOneDriveBasePath(path: string): Promise<void> {
  await setSetting(ONEDRIVE_BASE_PATH_KEY, path);
}

export async function hasOneDriveBasePath(): Promise<boolean> {
  return (await getOneDriveBasePath()) !== null;
}
