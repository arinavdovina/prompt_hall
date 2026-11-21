import { CONFIG, availableDays, openingTime, russianDate, shortDate } from './config.js';
import { candleImages, flameImage, hallBackground } from './images.js';
import { DAYS } from '../content/prompts.js';
import { initGlowCursor } from './glow-cursor.js';

const grid = document.querySelector('#candles-grid');
const backdrop = document.querySelector('#modal-backdrop');
const modal = document.querySelector('#prompt-modal');
const closeButton = document.querySelector('#modal-close');
const modalPrompts = document.querySelector('#modal-prompts');
const prevButton = document.querySelector('#modal-prev');
const nextButton = document.querySelector('#modal-next');
const toast = document.querySelector('#toast');
const VISITED_KEY = `great_prompt_hall_visited_dec_${CONFIG.startYear}`;
let visited = new Set();
try {
  const saved = JSON.parse(localStorage.getItem(VISITED_KEY) || '[]');
  visited = new Set(saved.filter(v => Number.isInteger(v) && v >= 1 && v <= CONFIG.totalDays));
} catch { /* Нет localStorage (например, в приватном режиме) — сайт работает и без него. */ }

const localhostPreview = ['localhost', '127.0.0.1'].includes(location.hostname) &&
  new URLSearchParams(location.search).get('preview') === 'all';
let unlocked = 0;
let selectedDay = 0;
let returnFocusTo = null;
let toastTimer;

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
}

function markVisited(day) {
  visited.add(day);
  try { localStorage.setItem(VISITED_KEY, JSON.stringify([...visited].sort((a,b)=>a-b))); } catch { /* Не критично */ }
}

function seedStars() {
  const el = document.querySelector('#stars');
  let seed = 24422;
  function random() { seed = (1664525 * seed + 1013904223) % 4294967296; return seed / 4294967296; }
  for (let i = 0; i < 63; i++) {
    const star = document.createElement('span');
    star.className = 'star';
    star.style.left = `${3 + random() * 94}%`;
    star.style.top = `${3 + random() * 94}%`;
    star.style.setProperty('--opacity', (.18 + random() * .61).toFixed(2));
    star.style.setProperty('--speed', `${(2.8 + random() * 5).toFixed(1)}s`);
    star.style.setProperty('--delay', `${(-random() * 7).toFixed(1)}s`);
    el.append(star);
  }
}

function remainingText(milliseconds) {
  const minutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  const d = Math.floor(minutes / 1440);
  const h = Math.floor(minutes % 1440 / 60);
  const m = minutes % 60;
  if (d) return `${d} д. ${h} ч.`;
  if (h) return `${h} ч. ${m} мин.`;
  return `${m} мин.`;
}

function updateProgress(now = new Date()) {
  document.querySelector('#progress-count').textContent =
    `${unlocked} из ${CONFIG.totalDays} свечей доступны`;
  document.querySelector('#progress-fill').style.width = `${(unlocked / CONFIG.totalDays) * 100}%`;
  const next = document.querySelector('#next-unlock');
  if (unlocked === CONFIG.totalDays) {
    next.textContent = 'Все свечи уже зажжены ✦';
  } else {
    next.textContent = `До следующей свечи — ${remainingText(openingTime(unlocked + 1) - now)}`;
  }
}

function createCandle(day) {
  const isOpen = day <= unlocked;
  const container = document.createElement('div');
  container.className = 'candle-slot';
  container.style.setProperty('--sway', `${(-day * .37).toFixed(2)}s`);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `candle-button ${isOpen ? 'unlocked' : 'locked'} ${visited.has(day) ? 'visited' : ''} ${day === unlocked ? 'current' : ''}`;
  button.setAttribute('aria-label', `Свеча ${day}, ${russianDate(day)}. ${isOpen ? 'Открыть три промпта' : 'Пока закрыта, откроется в 10:00 по Москве'}`);
  button.setAttribute('aria-disabled', String(!isOpen));
  button.dataset.day = day;
  const art = document.createElement('span');
  art.className = 'candle-art';
  const img = document.createElement('img');
  img.className = 'candle-image';
  img.src = candleImages[day - 1];
  img.alt = '';
  img.loading = day <= 8 ? 'eager' : 'lazy';
  img.decoding = 'async';
  img.addEventListener('error', () => {
    img.hidden = true;
    const emoji = document.createElement('span');
    emoji.className = 'candle-fallback';
    emoji.setAttribute('aria-hidden', 'true');
    art.append(emoji);
  }, { once: true });
  art.append(img);
  if (isOpen) {
    const halo = document.createElement('span');
    halo.className = 'flame-halo';
    const flame = document.createElement('img');
    flame.className = 'flame';
    flame.src = flameImage;
    flame.alt = '';
    flame.decoding = 'async';
    flame.addEventListener('error', () => { flame.hidden = true; halo.classList.add('css-flame'); }, { once: true });
    art.append(halo, flame);
  }
  const number = document.createElement('span');
  number.className = 'candle-number';
  number.textContent = String(day).padStart(2, '0');
  const date = document.createElement('span');
  date.className = 'candle-date';
  date.textContent = shortDate(day);
  button.append(art, number, date);
  if (!isOpen) {
    const lock = document.createElement('span');
    lock.className = 'candle-lock';
    lock.setAttribute('aria-hidden', 'true');
    lock.textContent = '✧';
    button.append(lock);
  }
  button.addEventListener('click', () => {
    if (day > unlocked) {
      showToast(`Свеча ${day} откроется ${russianDate(day)} в 10:00 МСК`);
      return;
    }
    returnFocusTo = button;
    markVisited(day);
    button.classList.add('visited');
    openModal(day);
  });
  container.append(button);
  return container;
}

function renderCalendar(now = new Date()) {
  unlocked = localhostPreview ? CONFIG.totalDays : availableDays(now);
  grid.replaceChildren(...Array.from({ length: CONFIG.totalDays }, (_, i) => createCandle(i + 1)));
  updateProgress(now);
}

async function copyPrompt(text, button) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const temp = document.createElement('textarea');
      temp.value = text;
      temp.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.append(temp);
      temp.focus();
      temp.select();
      const succeeded = document.execCommand('copy');
      temp.remove();
      if (!succeeded) throw Error('copy failed');
    }
    const label = button.querySelector('span');
    button.classList.add('copied');
    label.textContent = '✓ Скопировано';
    showToast('Промпт скопирован ✦');
    setTimeout(() => { label.textContent = 'Скопировать промпт'; button.classList.remove('copied'); }, 1900);
  } catch {
    showToast('Не получилось скопировать автоматически. Выделите текст вручную.');
  }
}

function createPromptCard(prompt, number) {
  const card = document.createElement('article');
  card.className = 'prompt-card';
  const upper = document.createElement('div');
  upper.className = 'prompt-top';
  const counter = document.createElement('span');
  counter.className = 'prompt-counter';
  counter.textContent = `ЗАКЛИНАНИЕ ${String(number).padStart(2,'0')}`;
  upper.append(counter);
  const heading = document.createElement('h3');
  heading.textContent = prompt?.title || `Промпт ${number}`;
  const text = document.createElement('div');
  text.className = 'prompt-text';
  const hasText = typeof prompt?.text === 'string' && !!prompt.text.trim();
  text.textContent = hasText ? prompt.text : 'Промпт для этого дня пока не добавлен.';
  if (!hasText) text.classList.add('is-empty');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy-btn';
  button.disabled = !hasText;
  button.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V4H4v12h4"/></svg><span>Скопировать промпт</span>';
  if (hasText) {
    button.addEventListener('click', () => copyPrompt(prompt.text, button));
  }
  card.append(upper, heading, text, button);
  return card;
}

function openModal(day) {
  if (day < 1 || day > unlocked) return;
  selectedDay = day;
  const data = DAYS[day];
  document.querySelector('#modal-date').textContent = russianDate(day);
  document.querySelector('#modal-title').textContent = data?.title || `Свеча ${day}: материалы готовятся`;
  document.querySelector('#modal-intro').textContent = data?.description || 'Здесь будут размещены три промпта для создания рабочих листов по английскому языку.';
  const prompts = Array.from({length:3}, (_,i) => createPromptCard(data?.prompts?.[i], i+1));
  modalPrompts.replaceChildren(...prompts);
  document.querySelector('#modal-pagination').textContent = `${String(day).padStart(2,'0')} / ${CONFIG.totalDays}`;
  prevButton.disabled = day === 1;
  nextButton.disabled = day >= unlocked;
  backdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  modal.scrollTop = 0;
  closeButton.focus({ preventScroll: true });
}

function closeModal() {
  if (backdrop.hidden) return;
  backdrop.hidden = true;
  selectedDay = 0;
  document.body.style.overflow = '';
  returnFocusTo?.focus({ preventScroll: true });
}

closeButton.addEventListener('click', closeModal);
backdrop.addEventListener('click', event => { if (event.target === backdrop) closeModal(); });
prevButton.addEventListener('click', () => { if (selectedDay > 1) openModal(selectedDay - 1); });
nextButton.addEventListener('click', () => { if (selectedDay < unlocked) openModal(selectedDay + 1); });
window.addEventListener('keydown', event => {
  if (backdrop.hidden) return;
  if (event.key === 'Escape') { closeModal(); return; }
  if (event.key === 'ArrowLeft' && selectedDay > 1 && !event.target.closest('.prompt-text')) openModal(selectedDay - 1);
  if (event.key === 'ArrowRight' && selectedDay < unlocked && !event.target.closest('.prompt-text')) openModal(selectedDay + 1);
  if (event.key === 'Tab') {
    const focusable = [...modal.querySelectorAll('button:not(:disabled)')];
    if (!focusable.length) return;
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});

document.querySelector('.site-background').style.backgroundImage = `url("${hallBackground}")`;
seedStars();
renderCalendar();
setInterval(() => {
  const now = new Date();
  const newUnlocked = localhostPreview ? CONFIG.totalDays : availableDays(now);
  if (newUnlocked !== unlocked) renderCalendar(now);
  else updateProgress(now);
}, 1000);

// WebGL-перенос пользовательского GlowCursor (React Bits), с 2D fallback для слабых устройств.
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  try {
    initGlowCursor(document.querySelector('#glow-layer'), {
      color: '#ffe0a2',
      secondaryColor: '#bb7642',
      intensity: 1.45,
      trailWidth: 3.8,
      linger: 1.6,
      glow: 1.4,
      hotspot: 0.95,
      followSpeed: 0.72,
      clickBurst: true,
      quality: 'medium',
      theme: 'dark',
      maxDevicePixelRatio: 1.75,
    });
  } catch (error) { console.warn('GlowCursor недоступен:', error); }
}
