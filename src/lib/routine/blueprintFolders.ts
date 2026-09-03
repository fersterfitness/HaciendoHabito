import type { Json, RoutineBlueprint } from '@/types/database'

const FOLDER_MARK = '_folder'

export function isBlueprintFolderPlaceholder(bp: Pick<RoutineBlueprint, 'payload'>): boolean {
  const p = bp.payload
  return Boolean(p && typeof p === 'object' && !Array.isArray(p) && (p as Record<string, unknown>)[FOLDER_MARK] === true)
}

export function folderPlaceholderPayload(): Json {
  return { [FOLDER_MARK]: true }
}

export function realBlueprints(items: RoutineBlueprint[]): RoutineBlueprint[] {
  return items.filter((bp) => !isBlueprintFolderPlaceholder(bp))
}
