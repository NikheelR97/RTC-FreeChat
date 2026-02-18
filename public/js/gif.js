import { elements } from './ui.js';

// Tenor API Key (Public Test Key)
const API_KEY = 'LIVDSRZULELA';
const CLIENT_KEY = 'RTC_FreeChat';
const BASE_URL = 'https://g.tenor.com/v1';

let nextPos = '';
let isLoading = false;
let currentSearch = '';

export function setupGifPicker() {
  if (!elements.gifButton || !elements.gifPicker) return;

  // Toggle Picker
  elements.gifButton.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.gifPicker.classList.toggle('hidden');
    elements.emojiPicker.classList.add('hidden'); // Close emoji picker if open

    if (!elements.gifPicker.classList.contains('hidden')) {
      if (!elements.gifPickerContent.hasChildNodes()) {
        fetchTrendingGifs();
      }
      elements.gifSearchInput.focus();
    }
  });

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (!elements.gifPicker.contains(e.target) && e.target !== elements.gifButton) {
      elements.gifPicker.classList.add('hidden');
    }
  });

  // Search
  let debounceTimer;
  elements.gifSearchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const query = e.target.value.trim();
      if (query !== currentSearch) {
        currentSearch = query;
        nextPos = ''; // Reset pagination
        if (query) {
          searchGifs(query);
        } else {
          fetchTrendingGifs();
        }
      }
    }, 500);
  });

  // Infinite Scroll (Simple version: load more button or scroll listener)
  elements.gifPickerContent.addEventListener('scroll', () => {
    if (isLoading) return;
    if (
      elements.gifPickerContent.scrollTop + elements.gifPickerContent.clientHeight >=
      elements.gifPickerContent.scrollHeight - 50
    ) {
      if (currentSearch) {
        searchGifs(currentSearch, true);
      } else {
        fetchTrendingGifs(true);
      }
    }
  });
}

async function fetchTrendingGifs(append = false) {
  if (isLoading) return;
  isLoading = true;

  if (!append)
    elements.gifPickerContent.innerHTML = '<div class="loading">Loading trending GIFs...</div>';

  try {
    const url = `${BASE_URL}/trending?key=${API_KEY}&client_key=${CLIENT_KEY}&limit=20&media_filter=minimal&pos=${nextPos}`;
    const res = await fetch(url);
    const data = await res.json();

    nextPos = data.next;
    renderGifs(data.results, append);
  } catch (err) {
    console.error('Failed to fetch GIFs', err);
    if (!append)
      elements.gifPickerContent.innerHTML = '<div class="error">Failed to load GIFs</div>';
  } finally {
    isLoading = false;
  }
}

async function searchGifs(query, append = false) {
  if (isLoading) return;
  isLoading = true;

  if (!append) {
    // Clear previous content and safely show loading text without interpreting `query` as HTML
    elements.gifPickerContent.textContent = '';
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.textContent = `Searching for "${query}"...`;
    elements.gifPickerContent.appendChild(loadingDiv);
  }

  try {
    const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}&key=${API_KEY}&client_key=${CLIENT_KEY}&limit=20&media_filter=minimal&pos=${nextPos}`;
    const res = await fetch(url);
    const data = await res.json();

    nextPos = data.next;
    renderGifs(data.results, append);
  } catch (err) {
    console.error('Failed to search GIFs', err);
    if (!append)
      elements.gifPickerContent.innerHTML = '<div class="error">Failed to search GIFs</div>';
  } finally {
    isLoading = false;
  }
}

function renderGifs(results, append) {
  if (!append) elements.gifPickerContent.innerHTML = '';

  // Remove loading indicator if present from previous append
  // (In a real infinite scroll, we'd manage this better, but this is simple)

  const fragment = document.createDocumentFragment();

  results.forEach((gif) => {
    // Use 'tinygif' for thumbnails to save bandwidth
    const media = gif.media[0].tinygif;

    const btn = document.createElement('button');
    btn.className = 'gif-item';

    const img = document.createElement('img');
    img.src = media.url;
    img.alt = gif.content_description || 'GIF';
    img.loading = 'lazy';

    btn.appendChild(img);

    btn.addEventListener('click', () => {
      sendGif(gif);
      elements.gifPicker.classList.add('hidden');
    });

    fragment.appendChild(btn);
  });

  if (results.length === 0 && !append) {
    elements.gifPickerContent.innerHTML = '<div class="no-results">No GIFs found</div>';
  } else {
    elements.gifPickerContent.appendChild(fragment);
  }
}

function sendGif(gifData) {


  // We send the higher quality 'gif' or 'mediumgif' for the chat
  // But 'tinygif' is good for preview. Let's use 'mediumgif' url.
  // Fallback to 'gif' if 'mediumgif' is missing
  const media = gifData.media[0].mediumgif || gifData.media[0].gif || gifData.media[0].tinygif;

  // We need to trigger the chat send logic.
  // Since we don't have direct access to socket here easily without circular dependencies,
  // we can either import state/socket or modify main.js to expose a send function.
  // OR we can emit a custom event on the document that main.js listens to.

  const event = new CustomEvent('send-gif', {
    detail: {
      url: media.url,
      originalName: 'giphy.gif', // or check content description
      mimeType: 'image/gif',
      size: media.size,
    },
  });
  document.dispatchEvent(event);
}
