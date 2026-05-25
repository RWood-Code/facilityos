import { create } from 'zustand';

export const useAppStore = create((set, get) => ({
  currentModule: 'dashboard',
  setModule: (m) => set({ currentModule: m }),
  facility: { id: 'fac1', name: 'EA Networks Centre' },
  setFacility: (f) => set({ facility: f }),
  settings: {},
  setSettings: (s) => set({ settings: s }),
  currentStaff: null,
  setCurrentStaff: (s) => set({ currentStaff: s }),
  licence: null,
  setLicence: (l) => set({ licence: l }),
  modal: null,
  modalData: null,
  openModal: (modal, data = null) => set({ modal, modalData: data }),
  closeModal: () => set({ modal: null, modalData: null }),
  toasts: [],
  toast: (msg, type = 'info') => {
    const id = Date.now();
    set(s => ({ toasts: [...s.toasts, { id, msg, type }] }));
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 3500);
  },
}));
