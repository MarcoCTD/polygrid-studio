import { create } from "zustand";
import type { Template, CreateTemplateInput } from "./types";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  softDeleteTemplate,
} from "@/services/database/queries/templates";

interface TemplateState {
  templates: Template[];
  isLoading: boolean;
  error: string | null;
  selectedTemplateId: string | null;

  fetchTemplates: () => Promise<void>;
  createTemplate: (input: CreateTemplateInput) => Promise<Template>;
  updateTemplate: (id: string, patch: Partial<CreateTemplateInput> & { platforms?: string[]; variables?: string[] }) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  selectTemplate: (id: string | null) => void;
}

export const useTemplateStore = create<TemplateState>((set) => ({
  templates: [],
  isLoading: false,
  error: null,
  selectedTemplateId: null,

  fetchTemplates: async () => {
    set({ isLoading: true, error: null });
    try {
      const templates = await listTemplates();
      set({ templates, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  createTemplate: async (input) => {
    const template = await createTemplate(input);
    set((s) => ({ templates: [template, ...s.templates] }));
    return template;
  },

  updateTemplate: async (id, patch) => {
    const updated = await updateTemplate(id, patch);
    set((s) => ({
      templates: s.templates.map((t) => (t.id === id ? updated : t)),
    }));
  },

  deleteTemplate: async (id) => {
    await softDeleteTemplate(id);
    set((s) => ({
      templates: s.templates.filter((t) => t.id !== id),
      selectedTemplateId: s.selectedTemplateId === id ? null : s.selectedTemplateId,
    }));
  },

  selectTemplate: (id) => set({ selectedTemplateId: id }),
}));

export function useSelectedTemplate() {
  const { templates, selectedTemplateId } = useTemplateStore();
  return templates.find((t) => t.id === selectedTemplateId) ?? null;
}
