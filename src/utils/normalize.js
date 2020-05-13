export function scaleText(pointSize, canvasH, height) {
  return Math.round((pointSize * height) / canvasH);
}

export function scaleX(x, canvasWidth, webDeviceWidth) {
  return Math.round((x / canvasWidth) * webDeviceWidth);
}

export function scaleY(y, canvasHeight, webDeviceHeight) {
  return Math.round((y / canvasHeight) * webDeviceHeight);
}

export function scaleWidth(width, canvasWidth, webDeviceWidth) {
  return Math.round(scaleX(width - 1, canvasWidth, webDeviceWidth) + 1);
}

export function scaleHeight(height, canvasHeight, webDeviceHeight) {
  return Math.round(scaleY(height - 1, canvasHeight, webDeviceHeight) + 1);
}

export function toInt(value, defaultValue) {
  if (!value) return defaultValue || value;

  const parsed = parseInt(value, 10);

  return isNaN(parsed) ? defaultValue || value : parsed;
}
