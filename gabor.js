function drawGabor(canvas, opts) {
  const orientation = opts.orientation ?? 0;
  const spatialFreq = opts.spatialFreq ?? 0.04;
  const sigma = opts.sigma ?? 32;
  const phase = opts.phase ?? 0;
  const contrast = opts.contrast ?? 1.0;

  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  const ori = orientation * Math.PI / 180;
  const cosO = Math.cos(ori);
  const sinO = Math.sin(ori);
  const twoSigSq = 2 * sigma * sigma;

  const img = ctx.createImageData(w, h);
  const data = img.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const xr = dx * cosO + dy * sinO;
      const grating = Math.cos(2 * Math.PI * spatialFreq * xr + phase);
      const env = Math.exp(-(dx * dx + dy * dy) / twoSigSq);
      const value = contrast * grating * env;
      const gray = Math.round(128 + 127 * value);
      const idx = (y * w + x) * 4;
      data[idx] = gray;
      data[idx + 1] = gray;
      data[idx + 2] = gray;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
}
