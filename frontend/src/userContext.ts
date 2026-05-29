export interface ConciliaUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  /** 0=VIP · 1=SA · 2=Admin · 3=Estándar */
  tipo: 0 | 1 | 2 | 3;
  token: string;
  ia_access: boolean;
  area_id: number | null;
  area_nombre: string;
  avatar: string | null;
}

declare global {
  interface Window {
    __CONCILIA_USER__?: ConciliaUser;
  }
}

const MOCK_USER: ConciliaUser = {
  id: 1,
  username: 'santiago',
  first_name: 'Santiago',
  last_name: '',
  tipo: 1,
  token: 'a1b2c3d4e5f6a7b8c9d0',
  ia_access: false,
  area_id: 5,
  area_nombre: 'Contabilidad',
  avatar: null,
};

export function getCurrentUser(): ConciliaUser {
  return window.__CONCILIA_USER__ ?? MOCK_USER;
}
