/** The supported snow-crystal morphologies (primary generation key). */
export type Morphology =
  | '角板'
  | '角柱'
  | '針'
  | 'さや'
  | '骸晶角柱'
  | '厚角板'
  | '骸晶角板'
  | '扇形'
  | '樹枝状'
  | '砲弾集合'
  | '側面';

export interface CrystalParams {
  /** Primary generation key (9 types). */
  morphology?: Morphology;
  /** Air temperature in °C (negative below freezing). With `supersaturation`, mapped to a morphology via `getCrystalType`. */
  temperature?: number;
  /** Supersaturation / vapor amount (0–0.3), the y-axis of the Nakaya diagram. */
  supersaturation?: number;
  /** Seed for the pseudo-random details (e.g. needle lengths). Same params + seed => same shape. */
  seed?: number;
}
