const IMAGE_FORMATS = {
  jpeg: 'JPG/JPEG',
  png: 'PNG',
  webp: 'WebP',
  gif: 'GIF'
};

function toBytes(data) {
  if (!data) return new Uint8Array(0);
  if (typeof data.length === 'number') return new Uint8Array(data);
  if (data.buffer && typeof data.byteLength === 'number') {
    return new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength);
  }
  if (typeof data.byteLength === 'number') {
    try {
      return new Uint8Array(data);
    } catch (error) {
      return new Uint8Array(0);
    }
  }
  return new Uint8Array(0);
}

function detectImageFormat(data) {
  const bytes = toBytes(data);
  if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'jpeg';
  }
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
      bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) {
    return 'png';
  }
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'webp';
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return 'gif';
  }
  return 'unknown';
}

function imageFormatLabel(format) {
  return IMAGE_FORMATS[format] || '未知格式';
}

module.exports = {
  detectImageFormat,
  imageFormatLabel
};
