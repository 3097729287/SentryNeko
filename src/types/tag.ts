/** Tag types mirrored from `models/tag.rs`; the todo page reads and writes them. */

export interface Tag {
  id: number;
  name: string;
  /** UTC epoch seconds. */
  createdAt: number;
}
