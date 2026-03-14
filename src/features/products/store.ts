import { create } from "zustand";
import type { Product, CreateProductInput } from "./types";
import {
  listProducts,
  createProduct,
  updateProduct,
  softDeleteProduct,
} from "@/services/database/queries/products";

interface ProductState {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  selectedProductId: string | null;

  fetchProducts: () => Promise<void>;
  createProduct: (input: CreateProductInput) => Promise<Product>;
  updateProduct: (id: string, patch: Partial<CreateProductInput> & { estimated_margin?: number | null }) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  selectProduct: (id: string | null) => void;
}

export const useProductStore = create<ProductState>((set) => ({
  products: [],
  isLoading: false,
  error: null,
  selectedProductId: null,

  fetchProducts: async () => {
    set({ isLoading: true, error: null });
    try {
      const products = await listProducts();
      set({ products, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  createProduct: async (input) => {
    try {
      console.log("[ProductStore] createProduct", input.name);
      const product = await createProduct(input);
      console.log("[ProductStore] Erstellt:", product.id);
      set((s) => ({ products: [product, ...s.products] }));
      return product;
    } catch (err) {
      console.error("[ProductStore] Fehler:", err);
      throw err;
    }
  },

  updateProduct: async (id, patch) => {
    const updated = await updateProduct(id, patch);
    set((s) => ({
      products: s.products.map((p) => (p.id === id ? updated : p)),
    }));
  },

  deleteProduct: async (id) => {
    await softDeleteProduct(id);
    set((s) => ({
      products: s.products.filter((p) => p.id !== id),
      selectedProductId: s.selectedProductId === id ? null : s.selectedProductId,
    }));
  },

  selectProduct: (id) => set({ selectedProductId: id }),
}));

export function useSelectedProduct() {
  const { products, selectedProductId } = useProductStore();
  return products.find((p) => p.id === selectedProductId) ?? null;
}
