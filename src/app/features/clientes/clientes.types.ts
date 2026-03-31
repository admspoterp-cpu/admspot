export type ClienteStatusKind = 'active' | 'inactive' | 'other';

export interface ClienteRow {
  id: number;
  fullName: string;
  documentDisplay: string;
  cityState: string;
  statusLabel: string;
  statusKind: ClienteStatusKind;
  initials: string;
  avatarBg: string;
  isPessoaFisica: boolean;
  /** Registro: `created_at` para filtro de data. */
  createdAtMs: number | null;
  stateNorm: string;
  /** Texto concatenado para pesquisa local. */
  searchBlob: string;
}
