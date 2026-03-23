export type TerritoryFilter = 'all' | 'mine' | 'enemy' | 'weak' | 'neutral';

export interface TerritoryDetail {
  id:        string;
  status:    'owned' | 'enemy' | 'neutral';
  ownerName: string | null;
  defense:   number;
  tier:      string;
}

export interface TerritoryStats {
  owned:   number;
  enemy:   number;
  neutral: number;
}

export interface TerritoryDetails {
  id:          string;
  h3Index?:    string;
  ownerName:   string | null;
  defense:     number;
  tier:        string;
  capturedAt?: string;
  isOwn:       boolean;
}
