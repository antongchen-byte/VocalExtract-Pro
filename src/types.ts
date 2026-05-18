export interface ExtractionResult {
  text: string;
  timestamp: string;
  fileName: string;
}

export type ExportFormat = 'txt' | 'docx';
