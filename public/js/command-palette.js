
import { state } from './state.js';
import { elements } from './ui.js';
import { leaveVoiceChannel, cleanupAllPeers } from './webrtc.js';

export function setupCommandPalette(switchChannel) {
    const modal = document.getElementById('command-palette-modal');
    const input = document.getElementById('command-palette-input');
    const resultsContainer = document.getElementById('command-palette-results');

    if (!modal || !input) return;

    let isOpen = false;
    let selectedIndex = 0;
    let filteredCommands = [];

    const commands = [
        {
            id: 'theme',
            label: 'Toggle Theme',
            icon: '🌓',
            action: () => document.getElementById('theme-toggle')?.click()
        },
        {
            id: 'mute',
            label: 'Toggle Mute',
            icon: '🔇',
            action: () => document.getElementById('mute-button')?.click()
        },
        {
            id: 'disconnect',
            label: 'Disconnect Voice',
            icon: '🚫',
            action: () => document.getElementById('voice-disconnect-btn')?.click()
        }
    ];

    function getCommands() {
        const dynamicCommands = [...commands];

        // Add channel switching commands
        state.channels.forEach((ch, id) => {
            dynamicCommands.push({
                id: `join-${id}`,
                label: `Join #${id}`,
                sub: ch.type === 'voice' ? 'Voice Channel' : 'Text Channel',
                icon: ch.type === 'voice' ? '🔊' : '#',
                action: () => window.switchChannel && window.switchChannel(id)
            });
        });

        return dynamicCommands;
    }

    function open() {
        isOpen = true;
        modal.classList.remove('hidden');
        input.value = '';
        input.focus();
        filterCommands('');
    }

    function close() {
        isOpen = false;
        modal.classList.add('hidden');
    }

    function filterCommands(query) {
        const all = getCommands();
        if (!query) {
            filteredCommands = all;
        } else {
            const lower = query.toLowerCase();
            filteredCommands = all.filter(c =>
                c.label.toLowerCase().includes(lower) ||
                (c.sub && c.sub.toLowerCase().includes(lower))
            );
        }
        selectedIndex = 0;
        render();
    }

    function render() {
        resultsContainer.innerHTML = '';
        if (filteredCommands.length === 0) {
            resultsContainer.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted)">No results found</div>';
            return;
        }

        filteredCommands.forEach((cmd, index) => {
            const div = document.createElement('div');
            div.className = `command-item ${index === selectedIndex ? 'selected' : ''}`;
            div.onclick = () => execute(cmd);
            div.innerHTML = `
                <div class="command-icon">${cmd.icon}</div>
                <div class="command-info">
                    <div class="command-label">${cmd.label}</div>
                    ${cmd.sub ? `<div class="command-sub">${cmd.sub}</div>` : ''}
                </div>
            `;
            resultsContainer.appendChild(div);
        });

        // Scroll into view
        const selected = resultsContainer.children[selectedIndex];
        if (selected) {
            selected.scrollIntoView({ block: 'nearest' });
        }
    }

    function execute(cmd) {
        if (cmd && cmd.action) {
            cmd.action();
            close();
        }
    }

    // Event Listeners
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (isOpen) close();
            else open();
        }

        if (isOpen && e.key === 'Escape') {
            close();
        }
    });

    input.addEventListener('input', (e) => {
        filterCommands(e.target.value);
    });

    input.addEventListener('keydown', (e) => {
        if (!isOpen) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % filteredCommands.length;
            render();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length;
            render();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            execute(filteredCommands[selectedIndex]);
        }
    });

    // Close on click outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });
}
