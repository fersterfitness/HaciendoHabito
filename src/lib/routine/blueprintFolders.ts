import type { Json, RoutineBlueprint } from '@/types/database'

const FOLDER_MARK = '_folder'

export type BlueprintFolderLevel = 'macro' | 'meso' | 'rutina'

export function isBlueprintFolderPlaceholder(bp: Pick<RoutineBlueprint, 'payload'>): boolean {
  const p = bp.payload
  return Boolean(p && typeof p === 'object' && !Array.isArray(p) && (p as Record<string, unknown>)[FOLDER_MARK] === true)
}

export function folderPlaceholderPayload(level?: BlueprintFolderLevel, routineGroup?: string): Json {
  return {
    [FOLDER_MARK]: true,
    ...(level ? { level } : {}),
    ...(routineGroup?.trim() ? { routine_group: routineGroup.trim() } : {}),
  }
}

export function blueprintRoutineGroup(bp: Pick<RoutineBlueprint, 'payload'>): string {
  const p = bp.payload
  if (!p || typeof p !== 'object' || Array.isArray(p)) return ''
  const g = (p as Record<string, unknown>).routine_group
  return typeof g === 'string' ? g.trim() : ''
}

export function withBlueprintMeta(
  payload: Json | null | undefined,
  meta: { routine_group?: string; objective?: string; audience?: string },
): Json {
  const base =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? { ...(payload as Record<string, unknown>) }
      : {}
  if (meta.routine_group != null) base.routine_group = meta.routine_group
  if (meta.objective != null) base.objective = meta.objective
  if (meta.audience != null) base.audience = meta.audience
  return base
}

export function blueprintObjective(bp: Pick<RoutineBlueprint, 'payload'>): string {
  const p = bp.payload
  if (!p || typeof p !== 'object' || Array.isArray(p)) return ''
  const o = (p as Record<string, unknown>).objective
  return typeof o === 'string' ? o : ''
}

export function blueprintAudience(bp: Pick<RoutineBlueprint, 'payload' | 'description'>): string {
  const p = bp.payload
  if (p && typeof p === 'object' && !Array.isArray(p)) {
    const a = (p as Record<string, unknown>).audience
    if (typeof a === 'string' && a.trim()) return a.trim()
  }
  return bp.description?.trim() ?? ''
}

export function realBlueprints(items: RoutineBlueprint[]): RoutineBlueprint[] {
  return items.filter((bp) => !isBlueprintFolderPlaceholder(bp))
}
