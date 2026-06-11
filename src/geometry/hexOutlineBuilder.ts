// ターン制約付き {10-10} アウトラインビルダー(docs/geometry-caseB-design.md §1〜§2)。
// THREE 非依存・純粋(crystallography.ts と同じ規約。Shape/押し出し化は parts.ts 層)。
// 案 B 内部 API — src/index.ts には export しない(公開は 0.3.0 以降で判断)。

/** 方位インデックス(実角 = d·60°、CCW 正)。d = 0/2/4 が a1/a2/a3、反平行は +3。 */
export type HexDir = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * 6 方位の単位ベクトルを基底 u = (1, 0)・v = (1/2, √3/2) の整数係数で表す
 * (設計書 §1.3 任意注記を採用)。位置の累積を係数 [cu, cv] の float 2 本で行う
 * ことで、加算経路に √3 が混入せず、丸めは辺長の加算のみに限定される。
 */
const DIR_UV: ReadonlyArray<readonly [number, number]> = [
  [1, 0], // d=0:  u
  [0, 1], // d=1:  v
  [-1, 1], // d=2:  v − u
  [-1, 0], // d=3: −u
  [0, -1], // d=4: −v
  [1, -1], // d=5:  u − v
];

/**
 * ターン制約付きアウトラインビルダー(設計書 §1)。
 *
 * 構成的保証(API で表現不能): 全エッジ方位 ∈ 60° 系列 / 全内角 ∈ {120°, 240°} /
 * 冗長頂点(180°)・縮退エッジなし。操作列は forward (turn forward)* close に限定
 * (交互規則: 連続 forward・連続 turn・turn 開始は throw)。
 *
 * close() の検証(§1.3): forward 終端 / 継ぎ目ターン t_close = (d_start − d_end) mod 6
 * ∈ {+1, −1}(始点頂点の内角保証)/ Σturn_explicit + t_close = ±6 / 位置閉合(ε)。
 * 位置は浮動小数の辺長和のためイプシロン検証、方位は整数のため厳密。
 */
export class HexOutlineBuilder {
  /** a 軸で開始方位を指定: d = 2·axis(antiparallel で +3)。 */
  static fromAxis(axis: 0 | 1 | 2, antiparallel = false): HexOutlineBuilder {
    return new HexOutlineBuilder(((2 * axis + (antiparallel ? 3 : 0)) % 6) as HexDir);
  }

  private readonly startDir: HexDir;
  private dir: HexDir;
  private cu = 0; // 位置の u 係数
  private cv = 0; // 位置の v 係数
  private lenSum = 0;
  private turnSum = 0; // 明示ターン総和(±1 単位)
  private lastOp: 'init' | 'forward' | 'turn' = 'init';
  private closed = false;
  private ccw = true;
  /** 頂点列([cu, cv] 係数表現)。[0] = 始点 (0, 0)。 */
  private readonly verts: Array<[number, number]> = [[0, 0]];

  constructor(startDir: HexDir = 0) {
    this.startDir = startDir;
    this.dir = startDir;
  }

  /** 現在方位へ len 進み頂点を打つ。len > 0、連続 forward は不可(交互規則)。 */
  forward(len: number): this {
    this.assertOpen('forward');
    if (this.lastOp === 'forward') {
      throw new Error('HexOutlineBuilder.forward: 連続 forward は不可(間に turn を挟む — 交互規則)');
    }
    if (!Number.isFinite(len) || !(len > 0)) {
      throw new Error(`HexOutlineBuilder.forward: len must be a finite number > 0 (got ${len})`);
    }
    const [du, dv] = DIR_UV[this.dir];
    this.cu += du * len;
    this.cv += dv * len;
    this.lenSum += len;
    this.verts.push([this.cu, this.cv]);
    this.lastOp = 'forward';
    return this;
  }

  /** +60°(左折)。forward の直後のみ可。 */
  turnLeft(): this {
    return this.turn(1, 'turnLeft');
  }

  /** −60°(右折)。forward の直後のみ可。 */
  turnRight(): this {
    return this.turn(-1, 'turnRight');
  }

  private turn(delta: 1 | -1, name: string): this {
    this.assertOpen(name);
    if (this.lastOp !== 'forward') {
      throw new Error(`HexOutlineBuilder.${name}: turn は forward の直後のみ(交互規則 — turn 開始・連続 turn は不可)`);
    }
    this.dir = ((((this.dir + delta) % 6) + 6) % 6) as HexDir;
    this.turnSum += delta;
    this.lastOp = 'turn';
    return this;
  }

  /** 閉路検証(設計書 §1.3)。以後の操作は不可。 */
  close(): void {
    this.assertOpen('close');
    // 1. forward 終端
    if (this.lastOp !== 'forward') {
      throw new Error('HexOutlineBuilder.close: 閉路は forward で終わる必要がある(turn 終端は不正)');
    }
    // 2. 継ぎ目ターン t_close ∈ {+1, −1}(始点頂点の内角 120°/240° 保証)
    const seamMod = (((this.startDir - this.dir) % 6) + 6) % 6;
    const tClose = seamMod === 1 ? 1 : seamMod === 5 ? -1 : null;
    if (tClose === null) {
      throw new Error(
        `HexOutlineBuilder.close: t_close = (d_start − d_end) mod 6 = ${seamMod} は {1, 5} 以外(始点頂点の内角が 120°/240° にならない)`,
      );
    }
    // 3. 回転総和(±360°)
    const total = this.turnSum + tClose;
    if (total !== 6 && total !== -6) {
      throw new Error(
        `HexOutlineBuilder.close: Σturn_explicit + t_close = ${total}(±6 以外 — 自己周回または不足)`,
      );
    }
    // 4. 位置閉合(係数残差を直交座標へ戻して距離評価)
    const eps = 1e-9 * Math.max(1, this.lenSum);
    const rx = this.cu + this.cv / 2;
    const ry = this.cv * (Math.sqrt(3) / 2);
    const residual = Math.hypot(rx, ry);
    if (residual > eps) {
      throw new Error(`HexOutlineBuilder.close: 位置が閉じていない(残差 ${residual} > ε ${eps})`);
    }
    this.verts.pop(); // 終端頂点(≈ 始点)は重複のため除去
    this.ccw = total === 6;
    this.closed = true;
  }

  /** close 後のみ。CCW 正規化済みの頂点列(始点が先頭、終端の重複なし)。 */
  points(): Array<[number, number]> {
    if (!this.closed) {
      throw new Error('HexOutlineBuilder.points: close() 後にのみ取得可能');
    }
    const pts = this.verts.map(
      ([cu, cv]) => [cu + cv / 2, (cv * Math.sqrt(3)) / 2] as [number, number],
    );
    if (!this.ccw) {
      // CW 定義 → 始点を先頭に保ったまま巡回順を反転して CCW へ
      const [head, ...rest] = pts;
      rest.reverse();
      return [head, ...rest];
    }
    return pts;
  }

  private assertOpen(op: string): void {
    if (this.closed) {
      throw new Error(`HexOutlineBuilder.${op}: close() 後の操作は不可`);
    }
  }
}

/**
 * 花形断面(辺中央凹み)— 設計書 §2.1。骸晶角柱・さや・針(中心柱)の共通断面。
 *
 * 正六角形(一辺 s = 外接半径 R)の各辺中央を 60° 系列のコの字で深さ
 * g = (√3/2)·w だけ内側へ彫り込んだ単一アウトライン。中心 = 原点に正規化。
 * 内角列(頂点順・始点 = 角頂点)= {120, 120, 240, 240, 120}×6、頂点 30、6 回対称。
 * 1 辺: forward(e) → L → forward(w) → R → forward(m) → R → forward(w) → L
 * → forward(e)(e = (R − m − w)/2)。最後の角部 turnLeft は省略し
 * t_close(+1)が補完する(§4)。
 *
 * 自己交差回避: e > 0(⇔ m + w < R)。g < apothem は e > 0・m > 0 から従うが、
 * 設計書の十分条件どおり防御的に検証する。
 */
export function dentedHexOutline(R: number, m: number, w: number): Array<[number, number]> {
  if (!(R > 0)) throw new Error(`dentedHexOutline: R must be > 0 (got ${R})`);
  if (!(m > 0)) throw new Error(`dentedHexOutline: m must be > 0 (got ${m})`);
  if (!(w > 0)) throw new Error(`dentedHexOutline: w must be > 0 (got ${w})`);
  const e = (R - m - w) / 2;
  if (!(e > 0)) {
    throw new Error(`dentedHexOutline: e = (R − m − w)/2 must be > 0 (got ${e}) — m + w < R が必要`);
  }
  const g = (Math.sqrt(3) / 2) * w;
  const apothem = (Math.sqrt(3) / 2) * R;
  if (!(g < apothem)) {
    throw new Error(`dentedHexOutline: 凹み深さ g = ${g} は apothem = ${apothem} 未満が必要`);
  }

  const b = new HexOutlineBuilder(0);
  for (let edge = 0; edge < 6; edge++) {
    b.forward(e).turnLeft().forward(w).turnRight().forward(m).turnRight().forward(w).turnLeft().forward(e);
    if (edge < 5) b.turnLeft(); // 角部。最終辺の角部ターンは t_close が補完
  }
  b.close();

  // 下地正六角形の中心 (R/2, (√3/2)·R) を原点へ
  const cx = R / 2;
  const cy = (Math.sqrt(3) / 2) * R;
  return b.points().map(([x, y]) => [x - cx, y - cy]);
}
