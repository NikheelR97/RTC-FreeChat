import { escapeHtml, getInitials } from '../public/js/utils.js';
import assert from 'assert';

console.log('Running utils.js unit tests...');

// escapeHtml
assert.strictEqual(escapeHtml('<script>'), '&lt;script&gt;', 'escapeHtml should escape < and >');
assert.strictEqual(escapeHtml('"quote"'), '&quot;quote&quot;', 'escapeHtml should escape quotes');
assert.strictEqual(escapeHtml('&'), '&amp;', 'escapeHtml should escape ampersand');
console.log('✅ escapeHtml passed');

// getInitials
assert.strictEqual(getInitials('John Doe'), 'JD', 'getInitials should return first letters');
assert.strictEqual(getInitials('Single'), 'S', 'getInitials should return single letter');
assert.strictEqual(getInitials('John Middle Doe'), 'JM', 'getInitials should take first two parts');
assert.strictEqual(getInitials('lowercase name'), 'LN', 'getInitials should uppercase');
console.log('✅ getInitials passed');

console.log('🎉 All unit tests passed!');
