export class RNG {
  private s: number;

  constructor(seed = Date.now()) {
    this.s = seed >>> 0;
  }

  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  serialize(): number {
    return this.s;
  }

  static deserialize(s: number): RNG {
    return new RNG(s);
  }
}