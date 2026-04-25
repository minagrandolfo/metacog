class RDKAnimator {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = canvas.width;
    this.h = canvas.height;
    this.cx = this.w / 2;
    this.cy = this.h / 2;
    this.aperture = opts.aperture ?? Math.min(this.w, this.h) * 0.45;
    this.nDots = opts.nDots ?? 150;
    this.dotSize = opts.dotSize ?? 2.5;
    this.coherence = opts.coherence ?? 0.3;
    this.direction = opts.direction ?? 0;
    this.speed = opts.speed ?? 3;
    this.lifetime = opts.lifetime ?? 8;
    this.dots = [];
    for (let i = 0; i < this.nDots; i++) this.dots.push(this.spawnDot(true));
    this.running = false;
  }

  spawnDot(initial) {
    const r = Math.sqrt(Math.random()) * this.aperture;
    const theta = Math.random() * Math.PI * 2;
    return {
      x: this.cx + r * Math.cos(theta),
      y: this.cy + r * Math.sin(theta),
      coherent: Math.random() < this.coherence,
      age: initial ? Math.floor(Math.random() * this.lifetime) : 0
    };
  }

  step() {
    for (let i = 0; i < this.dots.length; i++) {
      const dot = this.dots[i];
      dot.age++;
      if (dot.age >= this.lifetime) {
        this.dots[i] = this.spawnDot(false);
        continue;
      }
      let dx, dy;
      if (dot.coherent) {
        dx = this.speed * Math.cos(this.direction);
        dy = this.speed * Math.sin(this.direction);
      } else {
        const a = Math.random() * Math.PI * 2;
        dx = this.speed * Math.cos(a);
        dy = this.speed * Math.sin(a);
      }
      dot.x += dx;
      dot.y += dy;
      const dxa = dot.x - this.cx;
      const dya = dot.y - this.cy;
      if (dxa*dxa + dya*dya > this.aperture*this.aperture) {
        this.dots[i] = this.spawnDot(false);
      }
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.ctx.fillStyle = 'white';
    for (const dot of this.dots) {
      this.ctx.beginPath();
      this.ctx.arc(dot.x, dot.y, this.dotSize, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  run() {
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.step();
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() { this.running = false; }
}
