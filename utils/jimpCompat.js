function patchImage(image) {
  if (!image || image.__funBoyImageCompatPatched) return image;

  const originalResize = image.resize;
  if (typeof originalResize === 'function') {
    image.resize = function resizeCompat(width, height, mode) {
      if (typeof width === 'number' || typeof height === 'number') {
        return patchImage(originalResize.call(this, { w: width, h: height, mode }));
      }
      return patchImage(originalResize.call(this, width));
    };
  }

  const originalCrop = image.crop;
  if (typeof originalCrop === 'function') {
    image.crop = function cropCompat(x, y, width, height) {
      if (typeof x === 'number') return patchImage(originalCrop.call(this, { x, y, w: width, h: height }));
      return patchImage(originalCrop.call(this, x));
    };
  }

  const originalContain = image.contain;
  if (typeof originalContain === 'function') {
    image.contain = function containCompat(width, height, mode) {
      if (typeof width === 'number' || typeof height === 'number') {
        return patchImage(originalContain.call(this, { w: width, h: height, mode }));
      }
      return patchImage(originalContain.call(this, width));
    };
  }

  const originalCover = image.cover;
  if (typeof originalCover === 'function') {
    image.cover = function coverCompat(width, height, mode) {
      if (typeof width === 'number' || typeof height === 'number') {
        return patchImage(originalCover.call(this, { w: width, h: height, mode }));
      }
      return patchImage(originalCover.call(this, width));
    };
  }

  if (typeof image.getBuffer === 'function' && typeof image.getBufferAsync !== 'function') {
    image.getBufferAsync = function getBufferAsyncCompat(mime, options) {
      return this.getBuffer(mime, options);
    };
  }

  if (typeof image.write === 'function' && typeof image.writeAsync !== 'function') {
    image.writeAsync = function writeAsyncCompat(filePath, options) {
      return this.write(filePath, options);
    };
  }

  Object.defineProperty(image, '__funBoyImageCompatPatched', { value: true });
  return image;
}

function normalizeJimp(jimpModule) {
  if (!jimpModule) return jimpModule;

  const Jimp = jimpModule.Jimp || jimpModule.default || jimpModule;
  if (!Jimp) return jimpModule;

  const originalRead = Jimp.read || jimpModule.read;
  if (typeof originalRead === 'function' && !Jimp.__funBoyReadCompatPatched) {
    const readCompat = async (...args) => patchImage(await originalRead.apply(Jimp, args));
    Jimp.read = readCompat;
    jimpModule.read = readCompat;
    Object.defineProperty(Jimp, '__funBoyReadCompatPatched', { value: true });
  }

  const mime = jimpModule.JimpMime || {};
  const constants = {
    MIME_PNG: mime.png || 'image/png',
    MIME_JPEG: mime.jpeg || 'image/jpeg',
    MIME_JPG: mime.jpeg || 'image/jpeg',
    MIME_BMP: mime.bmp || 'image/bmp',
    MIME_GIF: mime.gif || 'image/gif',
    RESIZE_NEAREST_NEIGHBOR: jimpModule.ResizeStrategy?.NEAREST_NEIGHBOR,
    RESIZE_BILINEAR: jimpModule.ResizeStrategy?.BILINEAR,
    RESIZE_BICUBIC: jimpModule.ResizeStrategy?.BICUBIC,
    RESIZE_HERMITE: jimpModule.ResizeStrategy?.HERMITE,
    RESIZE_BEZIER: jimpModule.ResizeStrategy?.BEZIER
  };

  for (const [key, value] of Object.entries(constants)) {
    if (value !== undefined && Jimp[key] === undefined) Jimp[key] = value;
    if (value !== undefined && jimpModule[key] === undefined) jimpModule[key] = value;
  }

  return jimpModule;
}

module.exports = { normalizeJimp, patchImage };
