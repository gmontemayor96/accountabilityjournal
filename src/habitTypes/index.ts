import { countType, durationType } from "./amount";
import { checkType } from "./check";
import { registerHabitType } from "./registry";
import { scaleType } from "./scale";

// Register every habit type here. Order is the order shown in the habit editor.
registerHabitType(checkType);
registerHabitType(countType);
registerHabitType(durationType);
registerHabitType(scaleType);

export { allHabitTypes, getHabitType } from "./registry";
export type { HabitType, HabitInputProps } from "./registry";
