export const sounds = {
    message: () => playTone(800, 'sine', 0.1),
    join: () => playSequence([{ freq: 400, type: 'sine', duration: 0.1 }, { freq: 600, type: 'sine', duration: 0.1 }]),
    leave: () => playSequence([{ freq: 600, type: 'sine', duration: 0.1 }, { freq: 400, type: 'sine', duration: 0.1 }]),
    init: () => {
        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();
    }
};

let audioCtx = null;

function getContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

function playTone(freq, type, duration) {
    try {
        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + duration);
    } catch (e) {
        console.warn('Audio play failed', e);
    }
}

function playSequence(notes) {
    try {
        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();

        let startTime = ctx.currentTime;

        notes.forEach(note => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = note.type;
            osc.frequency.setValueAtTime(note.freq, startTime);

            gain.gain.setValueAtTime(0.1, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + note.duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + note.duration);

            startTime += note.duration + 0.05; // slight gap
        });
    } catch (e) {
        console.warn('Audio sequence failed', e);
    }
}
