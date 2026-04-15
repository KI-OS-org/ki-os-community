import { create } from "zustand";

type OrbitShellState = {
  activeSection: string;
  commandPaletteOpen: boolean;
  searchModalOpen: boolean;
  setActiveSection: (section: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSearchModalOpen: (open: boolean) => void;
};

export const useOrbitShellStore = create<OrbitShellState>((set) => ({
  activeSection: "Home",
  commandPaletteOpen: false,
  searchModalOpen: false,
  setActiveSection: (activeSection) => set({ activeSection }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setSearchModalOpen: (searchModalOpen) => set({ searchModalOpen }),
}));
