export function createGuardedImageSrcDescriptor(
  original: PropertyDescriptor,
  shouldBlock: (url: string) => boolean,
  onBlocked: (url: string) => void,
): PropertyDescriptor {
  return {
    get: function () {
      return original.get?.call(this) ?? '';
    },
    set: function (value: string) {
      if (shouldBlock(value)) {
        onBlocked(value);
        // Если src меняют у уже использованного Image, не оставляем старый URL.
        original.set?.call(this, '');
        return;
      }
      original.set?.call(this, value);
    },
    configurable: true,
    enumerable: original.enumerable,
  };
}
