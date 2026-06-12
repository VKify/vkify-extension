/**
 * Подстановка переменных шаблона: %first_name%, %last_name%, %my_first_name%,
 * %my_last_name%, %title%, %peer_id%, %time%, %date%, %br%.
 *
 * `myUserId` приходит из state фичи (резолвленный ID текущего пользователя);
 * остальное выводится из активного диалога (detectPeer) и VK API.
 */

import { vkApi } from '../../../../api/vk-api-client.js';
import { CHAT_PEER_OFFSET } from './constants.js';
import { detectPeer } from './peer.js';

export async function applyVariables(text: string, myUserId: number | null): Promise<string> {
  let out = text;
  const peer = await detectPeer();

  if (peer.peerId !== null) {
    out = out.replace(/%peer_id%/g, String(peer.peerId));
  }

  if (/%(first_name|last_name)%/.test(out)) {
    // По умолчанию — DOM-сплит на имя/фамилию. Если peer резолвлен,
    // уточняем через API: user → имя/фамилия раздельно; community →
    // название целиком в %first_name%, %last_name% пустой (для шаблонов
    // вида «Здравствуйте, %first_name%» в чате сообщества).
    let firstName = peer.firstName;
    let lastName  = peer.lastName;

    if (peer.peerId !== null) {
      if (peer.peerId > 0 && peer.peerId < CHAT_PEER_OFFSET) {
        const user = await vkApi.getUser(peer.peerId).catch(() => null);
        if (user) {
          firstName = user.firstName;
          lastName  = user.lastName;
        }
      } else if (peer.peerId < 0) {
        const group = await vkApi.getGroup(Math.abs(peer.peerId)).catch(() => null);
        const name = (group as { name?: string } | null)?.name;
        if (typeof name === 'string' && name.trim()) {
          firstName = name.trim();
          lastName  = '';
        } else if (peer.title) {
          // API недоступен (нет прав / нет токена) — берём заголовок из DOM
          // целиком как название сообщества, без сплита по пробелам.
          firstName = peer.title;
          lastName  = '';
        }
      }
    }

    out = out.replace(/%first_name%/g, firstName);
    out = out.replace(/%last_name%/g,  lastName);
  }

  if (/%title%/.test(out)) {
    out = out.replace(/%title%/g, peer.title);
  }

  if (myUserId !== null && /%(my_first_name|my_last_name)%/.test(out)) {
    const me = await vkApi.getUser(myUserId).catch(() => null);
    if (me) {
      out = out.replace(/%my_first_name%/g, me.firstName);
      out = out.replace(/%my_last_name%/g,  me.lastName);
    }
  }

  out = out
    .replace(/%time%/g, new Date().toLocaleTimeString('ru-RU'))
    .replace(/%date%/g, new Date().toLocaleDateString('ru-RU'))
    .replace(/%br%/g,   '\n')
    // Любые нерезолвленные плейсхолдеры схлопываем в пустую строку,
    // чтобы пользователь не отправил «Привет, %first_name%».
    .replace(/%(first_name|last_name|my_first_name|my_last_name|title|peer_id)%/g, '');

  return out;
}
