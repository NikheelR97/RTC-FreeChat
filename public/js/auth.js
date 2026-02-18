/* eslint-disable no-console */

const API_URL = '/api/auth';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
});

async function handleLogin(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const btn = document.getElementById('login-btn');

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) return;

    setLoading(btn, true);

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = '/';
        } else {
            showError(data.error || 'Login failed');
        }
    } catch (err) {
        console.error(err);
        showError('Network error. Please try again.');
    } finally {
        setLoading(btn, false);
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const btn = document.getElementById('signup-btn');

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) return;

    setLoading(btn, true);

    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = '/';
        } else {
            showError(data.error || 'Signup failed');
        }
    } catch (err) {
        console.error(err);
        showError('Network error. Please try again.');
    } finally {
        setLoading(btn, false);
    }
}

function setLoading(btn, isLoading) {
    if (isLoading) {
        btn.dataset.originalText = btn.textContent;
        btn.textContent = 'Please wait...';
        btn.disabled = true;
        btn.style.opacity = '0.7';
    } else {
        btn.textContent = btn.dataset.originalText || 'Submit';
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}

function showError(msg) {
    // Simple alert for now, could be a toast later
    alert(msg);
}
