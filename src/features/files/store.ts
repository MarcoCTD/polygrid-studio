import { create } from "zustand";
import type { FileLink, CreateFileLink, EntityType } from "./types";
import {
  listFileLinks,
  listFileLinksByEntity,
  createFileLink,
  deleteFileLink,
} from "@/services/database/queries/file-links";

interface FileLinksState {
  fileLinks: FileLink[];
  isLoading: boolean;
  error: string | null;

  loadFileLinks: () => Promise<void>;
  loadFileLinksByEntity: (entityType: EntityType, entityId: string) => Promise<void>;
  addFileLink: (data: CreateFileLink) => Promise<FileLink>;
  removeFileLink: (id: string) => Promise<void>;
}

export const useFileLinksStore = create<FileLinksState>((set, get) => ({
  fileLinks: [],
  isLoading: false,
  error: null,

  loadFileLinks: async () => {
    set({ isLoading: true, error: null });
    try {
      const fileLinks = await listFileLinks();
      set({ fileLinks, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  loadFileLinksByEntity: async (entityType: EntityType, entityId: string) => {
    set({ isLoading: true, error: null });
    try {
      const fileLinks = await listFileLinksByEntity(entityType, entityId);
      set({ fileLinks, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  addFileLink: async (data: CreateFileLink) => {
    const created = await createFileLink(data);
    set({ fileLinks: [created, ...get().fileLinks] });
    return created;
  },

  removeFileLink: async (id: string) => {
    await deleteFileLink(id);
    set({ fileLinks: get().fileLinks.filter((f) => f.id !== id) });
  },
}));
