/**
 * useNavigationHistory — synchronise l'état de navigation React avec l'History API du navigateur.
 *
 * Encode l'état dans le hash de l'URL (#/patients/123/prescriptions) pour :
 * - Permettre le back/forward du navigateur
 * - Permettre les bookmarks / refresh
 * - Pas besoin de config serveur (SPA fallback)
 */
import { useEffect, useRef, useCallback } from 'react';

// --- Conversions state ↔ hash ---

const defaultTabForScreen = {
  cabinet: 'cabinet-info',
  patients: null,
  tournee: null,
  agendas: null,
  facturation: null,
  administration: null,
};

function stateToHash({ activeScreen, activeTab, selectedPatientId, patientSubTab }) {
  if (activeScreen === 'cabinet') {
    if (activeTab === 'cabinet-info' || !activeTab) return '#/cabinet';
    return `#/cabinet/${activeTab}`;
  }

  if (activeScreen === 'patients') {
    if (!selectedPatientId) return '#/patients';
    if (selectedPatientId === 'new') return '#/patients/new';
    const sub = patientSubTab && patientSubTab !== 'info' ? `/${patientSubTab}` : '';
    return `#/patients/${selectedPatientId}${sub}`;
  }

  // Screens sans sous-navigation
  return `#/${activeScreen}`;
}

function hashToState(hash) {
  const path = (hash || '').replace(/^#\/?/, '');
  const segments = path.split('/').filter(Boolean);

  if (segments.length === 0) {
    return { activeScreen: 'cabinet', activeTab: 'cabinet-info', selectedPatientId: null, patientSubTab: 'info' };
  }

  const screen = segments[0];

  if (screen === 'cabinet') {
    const tab = segments[1] || 'cabinet-info';
    return { activeScreen: 'cabinet', activeTab: tab, selectedPatientId: null, patientSubTab: 'info' };
  }

  if (screen === 'patients') {
    if (segments.length === 1) {
      return { activeScreen: 'patients', activeTab: null, selectedPatientId: null, patientSubTab: 'info' };
    }
    const patientId = segments[1]; // 'new' ou un UUID
    const subTab = segments[2] || 'info';
    return { activeScreen: 'patients', activeTab: null, selectedPatientId: patientId, patientSubTab: subTab };
  }

  // Screens simples : agendas, tournee, facturation, administration
  const validScreens = ['agendas', 'tournee', 'facturation', 'administration'];
  if (validScreens.includes(screen)) {
    return { activeScreen: screen, activeTab: defaultTabForScreen[screen], selectedPatientId: null, patientSubTab: 'info' };
  }

  // Fallback
  return { activeScreen: 'cabinet', activeTab: 'cabinet-info', selectedPatientId: null, patientSubTab: 'info' };
}

// --- Hook principal ---

export function useNavigationHistory({
  activeScreen,
  activeTab,
  selectedPatientId,
  patientSubTab,
  restoreNavigation, // (state) => void — callback App.jsx pour restaurer l'état complet
}) {
  const isRestoringRef = useRef(false);
  const lastHashRef = useRef('');

  // --- Push state on navigation change ---
  useEffect(() => {
    // Ne pas pusher si on est en train de restaurer (popstate)
    if (isRestoringRef.current) return;

    const state = { activeScreen, activeTab, selectedPatientId, patientSubTab };
    const hash = stateToHash(state);

    // Éviter de pusher le même hash (double renders, etc.)
    if (hash === lastHashRef.current) return;

    lastHashRef.current = hash;
    window.history.pushState(state, '', hash);
  }, [activeScreen, activeTab, selectedPatientId, patientSubTab]);

  // --- Initialisation : replaceState pour l'état actuel ---
  useEffect(() => {
    const state = { activeScreen, activeTab, selectedPatientId, patientSubTab };
    const hash = stateToHash(state);
    lastHashRef.current = hash;
    window.history.replaceState(state, '', hash);
    // Uniquement au montage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Popstate listener ---
  const restoreRef = useRef(restoreNavigation);
  restoreRef.current = restoreNavigation;

  useEffect(() => {
    function handlePopState(event) {
      const state = event.state || hashToState(window.location.hash);
      if (!state || !state.activeScreen) return;

      isRestoringRef.current = true;
      lastHashRef.current = stateToHash(state);

      restoreRef.current(state);

      // Reset le flag après que React ait appliqué tous les state updates
      // On utilise un double requestAnimationFrame pour être sûr que le cycle
      // de rendu complet (avec les useEffect dépendants) est terminé
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isRestoringRef.current = false;
        });
      });
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // --- Restauration initiale depuis le hash (refresh / bookmark) ---
  const initialRestoreDone = useRef(false);
  useEffect(() => {
    if (initialRestoreDone.current) return;
    initialRestoreDone.current = true;

    const hash = window.location.hash;
    if (!hash || hash === '#/' || hash === '#/cabinet') return; // déjà sur la page par défaut

    const state = hashToState(hash);
    if (state.activeScreen === 'cabinet' && state.activeTab === 'cabinet-info' && !state.selectedPatientId) return;

    isRestoringRef.current = true;
    lastHashRef.current = stateToHash(state);
    restoreRef.current(state);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isRestoringRef.current = false;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
