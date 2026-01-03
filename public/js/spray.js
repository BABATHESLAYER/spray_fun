const socket = io();

// Parse Room ID from URL
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');

if (!roomId) {
    alert('No room specified! Scan the QR code on the desktop.');
} else {
    socket.emit('join_room', roomId);
    console.log('Joined Room:', roomId);
}

// UI Elements
const sprayBtn = document.getElementById('spray-btn');
const colorPicker = document.getElementById('color-picker');
const sizeSlider = document.getElementById('size-slider');
const recenterBtn = document.getElementById('recenter-btn');
const saveBtn = document.getElementById('save-btn');
const statusDiv = document.getElementById('status');

// State
let isSpraying = false;
let offset = { alpha: 0, beta: 0, gamma: 0 };
let audioCtx;
let noiseNode;
let gainNode;

// --- Audio Setup (Web Audio API) ---
function initAudio() {
    if (audioCtx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();

    // Create Noise Buffer
    const bufferSize = audioCtx.sampleRate * 2; // 2 seconds
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = buffer;
    noiseNode.loop = true;

    // Create Lowpass Filter (Muffle the noise a bit)
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;

    // Gain (Volume)
    gainNode = audioCtx.createGain();
    gainNode.gain.value = 0;

    noiseNode.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    noiseNode.start();
}

function playSound() {
    if (!audioCtx) initAudio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    // Ramp up
    gainNode.gain.setTargetAtTime(0.5, audioCtx.currentTime, 0.05);
}

function stopSound() {
    if (gainNode) {
        // Ramp down
        gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
    }
}

// --- Sensor Handling ---
function handleOrientation(event) {
    // Relaxed check: Some devices might not have alpha, but have beta/gamma
    if (event.beta === null || event.gamma === null) return;

    // Calculate relative angles based on offset
    // This is a simplified "Laser Pointer" logic.
    // Ideally we want to map phone tilt to screen coordinates (0-1).

    // Range of comfortable tilt: -45 to +45 degrees around the offset
    const tiltRange = 45;

    // Beta: Front/Back tilt (-180 to 180). Positive is tilting towards you (up on screen)
    // Gamma: Left/Right tilt (-90 to 90). Positive is tilting right (right on screen)
    // Alpha: Compass direction (0-360). Not reliable for "pointing" unless we use it carefully.
    // Let's use Beta (Y axis) and Gamma (X axis) for simpler 2D control if phone is held upright.

    // Adjust logic based on how phone is held (portrait vs landscape)
    // Assuming Portrait mode for simplicity as per HTML viewport

    let beta = event.beta - offset.beta;
    let gamma = event.gamma - offset.gamma;

    // Clamp
    // Normalize to 0-1 range where 0.5 is "center"
    let x = (gamma / tiltRange) + 0.5;
    let y = (beta / tiltRange) + 0.5; // Note: Check axis direction

    // Invert Y if natural feel requires it (usually tilting phone forward (neg beta) means up)
    // Default: Beta increases as you tilt top toward you.
    // We want: Tilt top away (neg beta) -> Cursor Up.
    // So we might need to invert.
    // Let's stick to the raw math first, user can "Recenter".

    socket.emit('tilt', {
        room: roomId,
        x: Math.min(Math.max(x, 0), 1),
        y: Math.min(Math.max(y, 0), 1)
    });
}

function requestSensorPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                    statusDiv.style.display = 'none';
                    initAudio();
                } else {
                    alert('Permission denied. Cannot track movement.');
                }
            })
            .catch(console.error);
    } else {
        // Non-iOS 13+ devices
        window.addEventListener('deviceorientation', handleOrientation);
        statusDiv.style.display = 'none';
        initAudio();
    }
}

// Show overlay on load to encourage interaction (needed for Audio/Sensors)
statusDiv.style.display = 'block';
statusDiv.addEventListener('click', requestSensorPermission);


// --- Interaction ---

// Spray Button
const startSpray = (e) => {
    e.preventDefault(); // Prevent text selection/ghost clicks
    if (isSpraying) return;
    isSpraying = true;
    sprayBtn.classList.add('active');
    playSound();
    if (navigator.vibrate) navigator.vibrate(200); // Initial kick
    socket.emit('spray_start', { room: roomId });
};

const endSpray = (e) => {
    e.preventDefault();
    if (!isSpraying) return;
    isSpraying = false;
    sprayBtn.classList.remove('active');
    stopSound();
    socket.emit('spray_end', { room: roomId });
};

// Touch Events
sprayBtn.addEventListener('touchstart', startSpray);
sprayBtn.addEventListener('touchend', endSpray);
// Mouse Events (for testing on desktop)
sprayBtn.addEventListener('mousedown', startSpray);
sprayBtn.addEventListener('mouseup', endSpray);

// Settings
colorPicker.addEventListener('input', (e) => {
    socket.emit('update_settings', { room: roomId, color: e.target.value });
});

sizeSlider.addEventListener('input', (e) => {
    socket.emit('update_settings', { room: roomId, size: e.target.value });
});

// Recenter
recenterBtn.addEventListener('click', () => {
    // Capture current orientation as the new "Zero"
    // We need to listen to one event to grab current values,
    // or just reset our offset variables next time 'deviceorientation' fires?
    // Better: set a flag to capture next event.

    const handler = (event) => {
        offset.beta = event.beta;
        offset.gamma = event.gamma;
        // Alpha is messy, let's ignore for now or add if needed for yaw
        window.removeEventListener('deviceorientation', handler);
        socket.emit('recenter', { room: roomId });
        if (navigator.vibrate) navigator.vibrate(50);
    };
    window.addEventListener('deviceorientation', handler);
});

// Save
saveBtn.addEventListener('click', () => {
    socket.emit('save_image_request', { room: roomId });
    if (navigator.vibrate) navigator.vibrate(50);
});
