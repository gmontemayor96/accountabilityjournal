import type { ComponentType } from "react";
import type { Habit, HabitEntry, HabitTypeKey } from "../domain/model";

export interface HabitInputProps {
  habit: Habit;
  value: number | null;
  onChange: (value: number | null) => void;
}

/**
 * A habit type is one module: how it is logged (Input), when it counts as done,
 * and how a value is shown. Screens only talk to this interface, so adding a
 * type means writing one module and registering it in ./index.ts.
 */
export interface HabitType {
  key: HabitTypeKey;
  label: string;
  description: string;
  usesTarget: boolean;
  defaultTarget?: number;
  defaultUnit?: string;
  isDone(habit: Habit, entry?: HabitEntry | null): boolean;
  format(habit: Habit, entry?: HabitEntry | null): string;
  Input: ComponentType<HabitInputProps>;
}

const types = new Map<HabitTypeKey, HabitType>();

export function registerHabitType(type: HabitType): void {
  types.set(type.key, type);
}

export function getHabitType(key: HabitTypeKey): HabitType {
  const type = types.get(key);
  if (!type) throw new Error(`Unknown habit type: ${key}`);
  return type;
}

export function allHabitTypes(): HabitType[] {
  return [...types.values()];
}

export const hasValue = (entry?: HabitEntry | null): entry is HabitEntry =>
  !!entry && entry.value !== null && entry.value !== 0;
