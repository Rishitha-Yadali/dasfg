export type LayoutType = 'standard' | 'compact';
export type PaperSize = 'a4' | 'letter';

export interface ExportOptions {
  layoutType: LayoutType;
  paperSize: PaperSize;
  fontFamily: string;
  nameSize: number;
  sectionHeaderSize: number;
  subHeaderSize: number;
  bodyTextSize: number;
  sectionSpacing: number; // in mm
  entrySpacing: number; // in mm (spacing between items in a list, e.g., bullets)
}

// Default export options
export const defaultExportOptions: ExportOptions = {
  layoutType: 'standard',
  paperSize: 'a4',
  fontFamily: 'Calibri',
  nameSize: 26,
  sectionHeaderSize: 11,
  subHeaderSize: 10.5,
  bodyTextSize: 10,
  sectionSpacing: 3, // mm
  entrySpacing: 2, // mm
};

// Layout configurations
export const layoutConfigs = {
  standard: {
    name: 'Standard',
    description: 'Professional layout with optimal spacing',
    margins: { top: 15, bottom: 10, left: 20, right: 20 },
    spacing: { section: 4, entry: 2.5 }
  },
  compact: {
    name: 'Compact',
    description: 'Condensed layout for more content',
    margins: { top: 10, bottom: 5, left: 15, right: 15 },
    spacing: { section: 2.5, entry: 1.5 }
  }
};

// Paper size configurations
export const paperSizeConfigs = {
  a4: {
    name: 'A4 (8.27" x 11.69")',
    width: 210, // mm
    height: 297 // mm
  },
  letter: {
    name: 'Letter (8.5" x 11")',
    width: 216, // mm
    height: 279 // mm
  }
};