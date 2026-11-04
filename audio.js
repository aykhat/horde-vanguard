// --- PROCEDURAL AUDIO SYNTHESIZERS ---
let audioCtx = null;
function getAudioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

function playSound(type) {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        const now = ctx.currentTime;

        if (type === 'shoot') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'hit') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.05);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'gem') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, now);
            osc.frequency.setValueAtTime(880, now + 0.06);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'levelup') {
            [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = 'triangle';
                o.connect(g);
                g.connect(ctx.destination);
                o.frequency.setValueAtTime(freq, now + i * 0.07);
                g.gain.setValueAtTime(0.18, now + i * 0.07);
                g.gain.linearRampToValueAtTime(0.01, now + i * 0.07 + 0.12);
                o.start(now + i * 0.07);
                o.stop(now + i * 0.07 + 0.12);
            });
        } else if (type === 'mythic') {
            [440, 554.37, 659.25, 880, 1108.73, 1318.51].forEach((freq, i) => {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = 'sawtooth';
                o.connect(g);
                g.connect(ctx.destination);
                o.frequency.setValueAtTime(freq, now + i * 0.08);
                g.gain.setValueAtTime(0.2, now + i * 0.08);
                g.gain.linearRampToValueAtTime(0.01, now + i * 0.08 + 0.15);
                o.start(now + i * 0.08);
                o.stop(now + i * 0.08 + 0.15);
            });
        } else if (type === 'hurt') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(30, now + 0.2);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        }
    } catch (e) {}
}