export interface SettingsDocumentEntry {
  id: number;
  ownerId: string;
  title: string;
  savedAt: number;
  size: number;
}

export interface SettingsDocumentList {
  documents: SettingsDocumentEntry[];
  userId: string;
}
