import {
  CharacterSheet,
  CharacterSheetField,
  CharacterSheetSchemaPage,
} from "../types/characterSheet";
import { PlayerCharacter } from "../types/evaSession";

export const GENERIC_TAB_KEY = "__generic";
export const TOOLS_TAB_KEY = "__tools";

export function extractSheet(data: unknown): CharacterSheet | null {
  if (!isObject(data) || !isObject(data.sheet)) return null;

  const sheet = data.sheet;
  const template = isObject(sheet.template) ? sheet.template : null;
  const fields = Array.isArray(sheet.fields) ? sheet.fields : [];
  const schema = parseSchema(isObject(template?.schema) ? template.schema : null);

  if (!template || (fields.length === 0 && (!schema || schema.fields.length === 0))) {
    return null;
  }

  const rawFields = fields
    .filter((field): field is Record<string, unknown> => isObject(field))
    .map((field) => normalizeSheetField(field, schema?.fields.find((schemaField) => schemaField.key === field.key)))
    .filter((field) => field.key || field.label);
  const fieldMap = new Map(rawFields.map((field) => [field.key, field]));

  for (const schemaField of schema?.fields || []) {
    if (fieldMap.has(schemaField.key)) continue;

    fieldMap.set(schemaField.key, normalizeSheetField({
      key: schemaField.key,
      label: schemaField.label,
      type: schemaField.type === "number"
        ? (schemaField.display === "counter" ? "b_int" : "int")
        : schemaField.type === "roll" ? "throw" : schemaField.type,
      group: "",
      favorite: false,
      value: schemaField.default ?? "",
      sortOrder: 0,
    }, schemaField));
  }

  return {
    template: {
      id: typeof template.id === "number" ? template.id : 0,
      key: typeof template.key === "string" ? template.key : "",
      label: typeof template.label === "string" ? template.label : "Ficha",
      schema: schema || undefined,
    },
    fields: [...fieldMap.values()],
  };
}

export function extractCharacters(data: unknown): PlayerCharacter[] {
  if (!isObject(data) || !Array.isArray(data.characters)) return [];

  return data.characters
    .filter((character): character is Record<string, unknown> => isObject(character))
    .map((character): PlayerCharacter | null => {
      const id = toNumber(character.id);
      const sheet = extractSheet({ sheet: character.sheet });

      if (id === null || !sheet) return null;

      return {
        id,
        name: getString(character.name) || getString(character.nombre) || `Personaje ${id}`,
        role: getString(character.role) || getString(character.rol) || "Personaje",
        playerName: getString(character.playerName) || getString(character.username) || "",
        sheet,
      };
    })
    .filter((character): character is PlayerCharacter => Boolean(character));
}

export function normalizeSheetField(
  field: Record<string, unknown>,
  schemaField?: CharacterSheetField["schema"]
): CharacterSheetField {
  return {
    key: typeof field.key === "string" ? field.key : "",
    label: typeof field.label === "string" ? field.label : schemaField?.label || "Campo",
    type: normalizeFieldType(typeof field.type === "string" ? field.type : schemaField?.type || "text", schemaField),
    group: typeof field.group === "string" ? field.group : "",
    favorite: field.favorite === true,
    value: Array.isArray(field.value)
      ? field.value.filter((item): item is Record<string, string> => isObject(item)).map((item) => (
          Object.fromEntries(Object.entries(item).map(([key, value]) => [key, String(value ?? "")]))
        ))
      : typeof field.value === "string" ? field.value : String(field.value ?? schemaField?.default ?? ""),
    config: isObject(field.config) ? {
      itemFields: Array.isArray(field.config.itemFields)
        ? field.config.itemFields
            .filter((itemField): itemField is Record<string, unknown> => isObject(itemField))
            .map((itemField, index) => ({
              key: typeof itemField.key === "string" ? itemField.key : "",
              label: typeof itemField.label === "string" ? itemField.label : "Campo",
              type: typeof itemField.type === "string" ? itemField.type : "text",
              defaultValue: typeof itemField.defaultValue === "string" ? itemField.defaultValue : "",
              sortOrder: typeof itemField.sortOrder === "number" ? itemField.sortOrder : (index + 1) * 10,
            }))
        : [],
    } : undefined,
    sortOrder: typeof field.sortOrder === "number" ? field.sortOrder : 0,
    schema: schemaField,
  };
}

export function normalizeFieldType(type: string, schemaField?: CharacterSheetField["schema"]) {
  if (schemaField?.type === "number") {
    return schemaField.display === "counter" ? "b_int" : "int";
  }
  if (schemaField?.type === "roll") return "throw";
  if (schemaField?.type) return schemaField.type;
  return type;
}

export function parseSchema(schema: unknown): CharacterSheet["template"]["schema"] | null {
  if (!isObject(schema)) return null;

  const fields = Array.isArray(schema.fields)
    ? schema.fields
        .filter((field): field is Record<string, unknown> => isObject(field))
        .map((field) => ({
          key: typeof field.key === "string" ? field.key : "",
          label: typeof field.label === "string" ? field.label : "Campo",
          type: typeof field.type === "string" ? field.type : "text",
          default: field.default,
          editable: typeof field.editable === "boolean" ? field.editable : undefined,
          display: typeof field.display === "string" ? field.display : undefined,
          formula: typeof field.formula === "string" ? field.formula : undefined,
          options: typeof field.options === "string" || Array.isArray(field.options) ? field.options : undefined,
          itemTemplate: isObject(field.itemTemplate) && Array.isArray(field.itemTemplate.fields)
            ? {
                fields: field.itemTemplate.fields
                  .filter((itemField): itemField is Record<string, unknown> => isObject(itemField))
                  .map((itemField) => ({
                    key: typeof itemField.key === "string" ? itemField.key : "",
                    label: typeof itemField.label === "string" ? itemField.label : "Campo",
                    type: typeof itemField.type === "string" ? itemField.type : "text",
                    default: itemField.default,
                  })),
              }
            : undefined,
        }))
        .filter((field) => field.key)
    : [];

  const pages = Array.isArray(schema.pages)
    ? schema.pages
        .filter((page): page is Record<string, unknown> => isObject(page))
        .map((page, pageIndex) => ({
          key: typeof page.key === "string" ? page.key : `page_${pageIndex + 1}`,
          label: typeof page.label === "string" ? page.label : `Página ${pageIndex + 1}`,
          sections: Array.isArray(page.sections)
            ? page.sections
                .filter((section): section is Record<string, unknown> => isObject(section))
                .map((section, sectionIndex) => ({
                  key: typeof section.key === "string" ? section.key : `section_${sectionIndex + 1}`,
                  label: typeof section.label === "string" ? section.label : `Sección ${sectionIndex + 1}`,
                  fields: Array.isArray(section.fields)
                    ? section.fields.filter((field): field is string => typeof field === "string")
                    : [],
                }))
            : [],
        }))
    : [];

  return {
    id: typeof schema.id === "string" ? schema.id : "",
    name: typeof schema.name === "string" ? schema.name : "Ficha",
    version: typeof schema.version === "number" ? schema.version : undefined,
    constants: isObject(schema.constants) ? schema.constants : undefined,
    fields,
    pages,
  };
}

export function getDynamicPages(sheet: CharacterSheet | null): CharacterSheetSchemaPage[] {
  if (!sheet) return [];

  const fieldKeys = new Set(sheet.fields.map((field) => field.key));
  const pages = (sheet.template.schema?.pages || [])
    .map((page) => ({
      ...page,
      sections: page.sections
        .map((section) => ({
          ...section,
          fields: section.fields.filter((fieldKey) => fieldKeys.has(fieldKey)),
        }))
        .filter((section) => section.fields.length > 0),
    }))
    .filter((page) => page.sections.length > 0);

  if (pages.length > 0) return pages;
  if (sheet.fields.length === 0) return [];

  const groups = new Map<string, CharacterSheetField[]>();
  for (const field of sheet.fields) {
    const group = field.group || "General";
    groups.set(group, [...(groups.get(group) || []), field]);
  }

  return [{
    key: "fallback",
    label: sheet.template.label || "Ficha",
    sections: [...groups.entries()].map(([group, fields], index) => ({
      key: `fallback_section_${index + 1}`,
      label: group,
      fields: fields.map((field) => field.key),
    })),
  }];
}

export function getGenericFields(
  sheet: CharacterSheet | null,
  pages: CharacterSheetSchemaPage[]
): CharacterSheetField[] {
  if (!sheet) return [];

  const pageFieldKeys = new Set(
    pages.flatMap((page) => page.sections.flatMap((section) => section.fields))
  );

  return sheet.fields.filter((field) => !pageFieldKeys.has(field.key));
}

export function isFieldEditable(field: CharacterSheetField) {
  if (field.schema?.formula) return false;
  if (field.schema?.editable === false) return false;
  if (field.type === "throw") return false;
  return true;
}

export function getFieldDisplayValue(sheet: CharacterSheet | null, field: CharacterSheetField) {
  if (field.schema?.formula) {
    return String(evaluateFormula(sheet, field.schema.formula));
  }

  if (Array.isArray(field.value)) return `${field.value.length}`;
  return String(field.value || (field.type === "throw" ? "d20" : "—"));
}

export function evaluateFormula(sheet: CharacterSheet | null, formula: string) {
  const values = new Map((sheet?.fields || []).map((field) => [
    field.key,
    Array.isArray(field.value) ? 0 : Number(field.value || 0),
  ]));
  const constants = sheet?.template.schema?.constants || {};

  const expression = formula
    .replace(/\$([a-zA-Z0-9_]+)\[\*([a-zA-Z0-9_]+)\]/g, (_match, constantKey, fieldKey) => {
      const constantGroup = constants[constantKey];
      const rawOption = sheet?.fields.find((field) => field.key === fieldKey)?.value;
      const option = Array.isArray(rawOption) ? "" : String(rawOption || "");

      if (isObject(constantGroup)) {
        const value = constantGroup[option];
        return String(typeof value === "number" ? value : Number(value || 0));
      }

      return "0";
    })
    .replace(/\*([a-zA-Z0-9_]+)/g, (_match, fieldKey) => String(values.get(fieldKey) || 0));

  if (!/^[0-9+\-*/ ().]+$/.test(expression)) return "—";

  try {
    const result = Function(`"use strict"; return (${expression});`)();
    return Number.isFinite(result) ? result : "—";
  } catch {
    return "—";
  }
}

export function getCycleOptions(sheet: CharacterSheet | null, field: CharacterSheetField) {
  const options = field.schema?.options;

  if (Array.isArray(options)) return options.map(String);

  if (typeof options === "string") {
    const constantGroup = sheet?.template.schema?.constants?.[options];
    if (isObject(constantGroup)) return Object.keys(constantGroup);
  }

  return ["untrained", "trained", "expert", "master", "legendary"];
}

export function formatCycleLabel(value: string) {
  const labels: Record<string, string> = {
    untrained: "Sin entrenar",
    trained: "Entrenado",
    expert: "Experto",
    master: "Maestro",
    legendary: "Legendario",
  };

  return labels[value] || value || "—";
}

export function getArrayItemFields(field: CharacterSheetField) {
  const itemFields = field.config?.itemFields?.length
    ? field.config.itemFields
    : field.schema?.itemTemplate?.fields?.map((itemField, index) => ({
        key: itemField.key,
        label: itemField.label,
        type: itemField.type === "number" ? "int" : itemField.type,
        defaultValue: String(itemField.default ?? ""),
        sortOrder: (index + 1) * 10,
      })) || [];

  if (itemFields.length > 0) return itemFields;
  return [{ key: "nombre", label: "Nombre", type: "text", defaultValue: "", sortOrder: 10 }];
}

export function getCharacterName(currentSheet: CharacterSheet | null, fallback: string) {
  const nameField = currentSheet?.fields.find((field) => (
    ["nombre", "name", "personaje", "character", "character_name"].includes(field.key)
    && typeof field.value === "string"
    && field.value.trim()
  ));

  return typeof nameField?.value === "string" ? nameField.value.trim() : fallback;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}
