const BASE36_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 10;

export function generateBoardId(): string {
  const array = new Uint8Array(ID_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => BASE36_CHARS[byte % 36]).join('');
}
