/**
 * toastStore — Global toast notification state.
 *
 * Minimal Zustand store for non-blocking confirmations.
 * The Toast component in root layout reads this store.
 */

import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'info';

interface ToastState {
  visible: boolean;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastActions {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  hideToast: () => void;
}

const initialState: ToastState = {
  visible: false,
  message: '',
  type: 'info',
  duration: 3000,
};

export const useToastStore = create<ToastState & ToastActions>()((set) => ({
  ...initialState,

  showToast: (message, type = 'success', duration = 3000) => {
    set({ visible: true, message, type, duration });
  },

  hideToast: () => {
    set({ visible: false });
  },
}));
