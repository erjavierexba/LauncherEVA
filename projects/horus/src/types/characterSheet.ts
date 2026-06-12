export type CharacterSheetField = {
  key: string;
  label: string;
  type: string;
  group: string;
  favorite: boolean;
  value: string | Array<Record<string, string>>;
  config?: {
    itemFields?: Array<{
      key: string;
      label: string;
      type: string;
      defaultValue: string;
      sortOrder: number;
    }>;
  };
  sortOrder: number;
  schema?: CharacterSheetSchemaField;
};

export type CharacterSheet = {
  template: {
    id: number;
    key: string;
    label: string;
    schema?: CharacterSheetSchema;
  };
  fields: CharacterSheetField[];
};

export type CharacterSheetSchemaField = {
  key: string;
  label: string;
  type: string;
  default?: unknown;
  editable?: boolean;
  display?: string;
  formula?: string;
  options?: string | string[];
  itemTemplate?: {
    fields?: CharacterSheetSchemaField[];
  };
};

export type CharacterSheetSchemaSection = {
  key: string;
  label: string;
  fields: string[];
};

export type CharacterSheetSchemaPage = {
  key: string;
  label: string;
  sections: CharacterSheetSchemaSection[];
};

export type CharacterSheetSchema = {
  id: string;
  name: string;
  version?: number;
  constants?: Record<string, unknown>;
  fields: CharacterSheetSchemaField[];
  pages: CharacterSheetSchemaPage[];
};
