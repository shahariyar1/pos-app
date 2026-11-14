import { create } from "zustand";

type UiState = { paletteOpen: boolean; setPaletteOpen: (open: boolean) => void };
export const useUi = create<UiState>((set) => ({
  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
}));
