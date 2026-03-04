/** Data for a dismissible filter chip in a toolbar. */
export interface ChipData {
  /** Unique identifier within a chip set; used as React key to prevent label collisions. */
  id: string;
  label: string;
  onDismiss: () => void;
}
