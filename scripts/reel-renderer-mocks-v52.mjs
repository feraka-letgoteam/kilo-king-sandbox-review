// Instrumented display objects only; never a GPU render.
const point = () => ({
  x: 0,
  y: 0,
  set(x, y = x) {
    this.x = x;
    this.y = y;
  },
});
class Container {
  constructor() {
    this.children = [];
    this.position = point();
    this.pivot = point();
    this.scale = point();
    this.scale.set(1);
    this.alpha = 1;
    this.visible = true;
    this.destroyed = false;
  }
  addChild(...nodes) {
    for (const n of nodes) {
      n.parent = this;
      this.children.push(n);
    }
    return nodes[0];
  }
  addChildAt(n, i) {
    n.parent = this;
    this.children.splice(i, 0, n);
    return n;
  }
  removeChildren() {
    const old = this.children;
    this.children = [];
    old.forEach((n) => (n.parent = null));
    return old;
  }
  destroy() {
    this.destroyed = true;
    this.removeChildren().forEach((n) => n.destroy());
    if (this.parent)
      this.parent.children = this.parent.children.filter((n) => n !== this);
  }
  get width() {
    return this._width ?? Math.max(0, ...this.children.map((c) => c.width));
  }
  set width(v) {
    this._width = v;
  }
  get height() {
    return this._height ?? Math.max(0, ...this.children.map((c) => c.height));
  }
  set height(v) {
    this._height = v;
  }
}
class Graphics extends Container {
  rect() {
    return this;
  }
  roundRect() {
    return this;
  }
  fill() {
    return this;
  }
  stroke() {
    return this;
  }
  circle() {
    return this;
  }
  ellipse() {
    return this;
  }
  poly() {
    return this;
  }
  moveTo() {
    return this;
  }
  lineTo() {
    return this;
  }
  clear() {
    return this;
  }
}
class Text extends Container {
  constructor({ text, style }) {
    super();
    this.text = text;
    this.style = style;
    this.anchor = point();
  }
  get width() {
    return String(this.text).length * Number(this.style.fontSize) * 0.62;
  }
  get height() {
    return Number(this.style.fontSize) * 1.3;
  }
}
class Sprite extends Container {
  constructor(texture) {
    super();
    this.texture = texture;
    this.anchor = point();
  }
}
class Texture {
  constructor(o) {
    Object.assign(this, o);
  }
  destroy() {}
}
class Rectangle {
  constructor(x, y, w, h) {
    Object.assign(this, { x, y, width: w, height: h });
  }
}

export {Container, Graphics, Text, Sprite, Texture, Rectangle};
