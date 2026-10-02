import { SAVE_VERSION, type GameState } from './core/game';
import { RNG } from './core/rng';

const USERS_KEY   = 'cards_users';
const SESSION_KEY = 'cards_session';

interface StoredUser {
  nick: string;
  salt: string;
  passwordHash: string;
  createdAt: number;
}

// ---------- Работа с пользователями ----------

function loadUsers(): StoredUser[] {
  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function randomSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return [...arr].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------- Регистрация / Вход ----------

export async function register(nick: string, password: string): Promise<void> {
  nick = nick.trim();
  if (nick.length < 3) throw new Error('Ник минимум 3 символа');
  if (!/^[a-zA-Zа-яА-Я0-9_]+$/.test(nick)) throw new Error('Ник: буквы, цифры, _');
  if (password.length < 4) throw new Error('Пароль минимум 4 символа');

  const users = loadUsers();
  if (users.some(u => u.nick.toLowerCase() === nick.toLowerCase())) {
    throw new Error('Такой ник уже занят');
  }

  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  users.push({ nick, salt, passwordHash, createdAt: Date.now() });
  saveUsers(users);
}

export async function login(nick: string, password: string): Promise<void> {
  nick = nick.trim();
  const users = loadUsers();
  const user = users.find(u => u.nick.toLowerCase() === nick.toLowerCase());
  if (!user) throw new Error('Пользователь не найден');

  const passwordHash = await hashPassword(password, user.salt);
  if (passwordHash !== user.passwordHash) throw new Error('Неверный пароль');
}

// ---------- Сессия ----------

export function setSession(nick: string): void {
  localStorage.setItem(SESSION_KEY, nick);
}

export function getSession(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

// ---------- Сохранение игры ----------

function saveKey(nick: string): string {
  return `cards_save_${nick}`;
}

export function saveGame(nick: string, state: GameState): void {
  const serialized = JSON.stringify(state, (key, value) => {
    if (key === 'rng' && value instanceof RNG) {
      return { __rng: value.serialize() };
    }
    return value;
  });
  localStorage.setItem(saveKey(nick), serialized);
}

export function loadGame(nick: string): GameState | null {
  const raw = localStorage.getItem(saveKey(nick));
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);

    // Проверка версии — если старая или отсутствует, отбрасываем сохранение
    if (typeof obj?.version !== 'number' || obj.version !== SAVE_VERSION) {
      console.warn(
        `[save] Версия сохранения не совпадает (ожидается ${SAVE_VERSION}, ` +
        `найдено ${obj?.version ?? 'нет'}). Создаём новую игру.`
      );
      localStorage.removeItem(saveKey(nick));
      return null;
    }

    if (obj.rng && typeof obj.rng === 'object' && '__rng' in obj.rng) {
      obj.rng = RNG.deserialize(obj.rng.__rng);
    }
    return obj as GameState;
  } catch {
    return null;
  }
}