export class Position {
  constructor({ x = 0, y = 0 }) {
    this.x = x;
    this.y = y;
  }
}

export class Boundary {
  static width = 64;
  static height = 64;
  constructor({ position = Position() }) {
    this.position = position;
    this.width = 64;
    this.height = 64;
  }
}
