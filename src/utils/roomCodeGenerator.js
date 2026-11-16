import { GAME_CONFIG } from '../config/constants.js';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateUniqueRoomCode(existingRoomsMap) {
  let code;
  do {
    code = '';
    for (let i = 0; i < GAME_CONFIG.ROOM_CODE_LENGTH; i++) {
      code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }
  } while (existingRoomsMap.has(code));

  return code;
}