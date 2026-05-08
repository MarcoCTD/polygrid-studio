import type { TemplateVariable } from '../schemas';

const TEMPLATE_VARIABLE_REGEX = /\{\{([^}]+)\}\}/g;

export function extractVariables(content: string): string[] {
  const variables = new Set<string>();

  for (const match of content.matchAll(TEMPLATE_VARIABLE_REGEX)) {
    const name = match[1]?.trim();
    if (name) {
      variables.add(name);
    }
  }

  return Array.from(variables).sort((a, b) => a.localeCompare(b, 'de'));
}

export function mergeVariables(detected: string[], stored: TemplateVariable[]): TemplateVariable[] {
  const storedByName = new Map(stored.map((variable) => [variable.name, variable]));
  const merged = new Map<string, TemplateVariable>();

  for (const name of detected) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    merged.set(trimmed, storedByName.get(trimmed) ?? { name: trimmed, description: '' });
  }

  for (const variable of stored) {
    if (!merged.has(variable.name)) {
      merged.set(variable.name, variable);
    }
  }

  return Array.from(merged.values());
}
