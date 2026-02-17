import { elements } from './ui.js';

let emojiData = null;
let currentCategory = 'Smileys & Emotion';

// CDN for emoji data (still using for list/categories)
const DATA_URL = 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.0.1/emoji.json';

const CATEGORIES = [
  { name: 'Smileys & Emotion', icon: '😀' },
  { name: 'People & Body', icon: '👋' },
  { name: 'Animals & Nature', icon: '🐻' },
  { name: 'Food & Drink', icon: '🍔' },
  { name: 'Activities', icon: '⚽' },
  { name: 'Travel & Places', icon: '🚗' },
  { name: 'Objects', icon: '💡' },
  { name: 'Symbols', icon: '❤️' },
  { name: 'Flags', icon: '🏳️' },
];

export async function setupEmojiPicker() {
  if (!elements.emojiButton || !elements.emojiPicker) return;

  // Toggle Picker
  elements.emojiButton.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.emojiPicker.classList.toggle('hidden');
    if (!elements.emojiPicker.classList.contains('hidden')) {
      loadEmojiData();
      elements.emojiSearchInput.focus();
    }
  });

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (!elements.emojiPicker.contains(e.target) && e.target !== elements.emojiButton) {
      elements.emojiPicker.classList.add('hidden');
    }
  });

  // Search
  elements.emojiSearchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    renderEmojis(query);
  });

  // Tabs
  renderTabs();
}

async function loadEmojiData() {
  if (emojiData) return;

  try {
    elements.emojiPickerContent.innerHTML = '<div class="loading">Loading emojis...</div>';
    const res = await fetch(DATA_URL);
    const data = await res.json();

    // Filter and organize
    emojiData = data.filter((e) => e.has_img_apple).sort((a, b) => a.sort_order - b.sort_order);

    renderEmojis();
  } catch (err) {
    console.error('Failed to load emojis', err);
    elements.emojiPickerContent.innerHTML = '<div class="error">Failed to load emojis</div>';
  }
}

function renderTabs() {
  elements.emojiPickerTabs.innerHTML = '';
  CATEGORIES.forEach((cat) => {
    const btn = document.createElement('button');
    btn.className = `emoji-tab ${cat.name === currentCategory ? 'active' : ''}`;
    btn.textContent = cat.icon;
    btn.title = cat.name;
    btn.addEventListener('click', () => {
      currentCategory = cat.name;
      document.querySelectorAll('.emoji-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      elements.emojiSearchInput.value = ''; // clear search on category change
      renderEmojis();
    });
    elements.emojiPickerTabs.appendChild(btn);
  });
}

function renderEmojis(searchQuery = '') {
  if (!emojiData) return;

  elements.emojiPickerContent.innerHTML = '';

  // Virtual rendering or just render limit for performance?
  // Let's render limit for now (first 200 matches) to avoid freezing
  let count = 0;
  const MAX_RENDER = 300;

  const fragment = document.createDocumentFragment();

  for (const emoji of emojiData) {
    if (count >= MAX_RENDER) break;

    // Filter by Category (if not searching) or Search Query
    let match = false;
    if (searchQuery) {
      if (
        emoji.short_name.includes(searchQuery) ||
        (emoji.keywords && emoji.keywords.some((k) => k.includes(searchQuery)))
      ) {
        match = true;
      }
    } else {
      if (emoji.category === currentCategory) {
        match = true;
      }
    }

    if (match) {
      const btn = document.createElement('button');
      btn.className = 'emoji-item';

      const nativeEmoji = String.fromCodePoint(...emoji.unified.split('-').map((u) => '0x' + u));
      btn.textContent = nativeEmoji;
      btn.title = `:${emoji.short_name}:`;

      btn.addEventListener('click', () => {
        insertEmoji(nativeEmoji);
      });

      fragment.appendChild(btn);
      count++;
    }
  }

  if (count === 0) {
    elements.emojiPickerContent.innerHTML = '<div class="no-results">No emojis found</div>';
  } else {
    elements.emojiPickerContent.appendChild(fragment);
  }
}

function insertEmoji(unicode) {
  const input = elements.chatInput;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const text = input.value;

  input.value = text.substring(0, start) + unicode + text.substring(end);
  input.selectionStart = input.selectionEnd = start + unicode.length;
  input.focus();
}
