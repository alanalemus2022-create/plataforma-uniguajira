import { useSyncExternalStore } from 'react';
/** Suscribe un componente al controlador (o al puente aislado). */
export function useControlador(c) { return useSyncExternalStore(c.suscribir, c.estado, c.estado); }
