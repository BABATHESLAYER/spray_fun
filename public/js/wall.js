const socket = io();
const canvas = document.getElementById('wall-canvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('connect-overlay');
const statusText = document.getElementById('connection-status');
const qrCanvas = document.getElementById('qrcode');

// Generate a random room ID
const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
console.log('Room ID:', roomId);

// Connect to room
socket.emit('join_room', roomId);

// Request Server IP for valid QR Code
socket.emit('get_server_ip');

socket.on('server_ip', (data) => {
    let host = window.location.host;
    // If we are on localhost, use the server detected IP if available
    if ((host.startsWith('localhost') || host.startsWith('127.0.0.1')) && data.ip && data.ip !== 'localhost') {
        host = `${data.ip}:${window.location.port || 3000}`;
    }

    // Generate QR Code
    const mobileUrl = `${window.location.protocol}//${host}/mobile?room=${roomId}`;

    // Clear previous if any (though usually runs once)
    const context = qrCanvas.getContext('2d');
    context.clearRect(0, 0, qrCanvas.width, qrCanvas.height);

    QRCode.toCanvas(qrCanvas, mobileUrl, { width: 200 }, function (error) {
        if (error) console.error(error);
        console.log('QR Code generated for:', mobileUrl);
        // Show the URL text below for manual entry if needed
        statusText.innerHTML = `Scan above or visit:<br><small>${mobileUrl}</small>`;
    });
});

// Canvas Setup
let width, height;
function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}
window.addEventListener('resize', resize);
resize();

// Cursor State
let cursor = { x: width / 2, y: height / 2 };
let isSpraying = false;
let currentColor = '#ff0000';
let currentSize = 20;

// Hide overlay when cursor moves (implies connection) or when specific event received
let connected = false;

// Drawing Loop (High frequency)
function draw() {
    if (isSpraying) {
        // Spray Effect: Draw multiple random particles within radius
        const density = currentSize * 2; // More particles for larger size
        ctx.fillStyle = currentColor;

        for (let i = 0; i < density; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * currentSize;
            const px = cursor.x + Math.cos(angle) * radius;
            const py = cursor.y + Math.sin(angle) * radius;

            ctx.globalAlpha = Math.random() * 0.5 + 0.5; // Random opacity
            ctx.beginPath();
            ctx.arc(px, py, Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Draw Cursor Indicator (Ghost)
    if (connected) {
        // Optional: Show a faint ring where the cursor is
        // We can draw this on a separate layer if we want to clear it,
        // but for a graffiti wall, maybe we don't want a permanent cursor?
        // Let's skip drawing a permanent cursor to keep the wall clean,
        // or maybe just a very faint transient indicator?
        // For now, no cursor indicator, just the paint.
    }

    requestAnimationFrame(draw);
}
draw();

// Drip Logic
let lastPos = { x: 0, y: 0 };
let stationaryTime = 0;
const DRIP_THRESHOLD = 60; // Frames (~1 sec)

function dripCheck() {
    if (isSpraying) {
        const dist = Math.hypot(cursor.x - lastPos.x, cursor.y - lastPos.y);
        if (dist < 5) {
            stationaryTime++;
        } else {
            stationaryTime = 0;
            lastPos = { x: cursor.x, y: cursor.y };
        }

        if (stationaryTime > DRIP_THRESHOLD) {
            // Draw Drip
            ctx.fillStyle = currentColor;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            // Random drip length
            const dripLength = Math.random() * 5 + 2;
            ctx.rect(cursor.x - (Math.random() * 2), cursor.y, Math.random() * 2 + 1, dripLength);
            ctx.fill();

            // Move "cursor" for drip slightly down so it grows
            // Actually, usually drips run down from the paint.
            // Let's just draw lines going down from current pos.
            // Simple visual hack:
            ctx.beginPath();
            ctx.arc(cursor.x, cursor.y + stationaryTime - DRIP_THRESHOLD, 2, 0, Math.PI*2);
            ctx.fill();
        }
    } else {
        stationaryTime = 0;
    }
    requestAnimationFrame(dripCheck);
}
dripCheck();

// Socket Events
socket.on('update_cursor', (data) => {
    if (!connected) {
        connected = true;
        overlay.classList.add('hidden');
    }

    // Laser Pointer Logic
    // data: { alpha (yaw), beta (pitch), gamma (roll) }
    // We need to map orientation to screen coordinates.
    // This is tricky without absolute reference.
    // We assume 'data' also sends a processed dx/dy or we calculate relative movement.

    // Logic: The phone sends raw orientation.
    // Ideally, the phone sends "deltas" or we calculate deltas here.
    // But sending deltas from phone is better.

    // Let's assume the phone sends normalized coordinates (x, y) from 0 to 1 based on its "center".
    if (data.x !== undefined && data.y !== undefined) {
        cursor.x = data.x * width;
        cursor.y = data.y * height;
    }
});

socket.on('spray_start', () => {
    isSpraying = true;
});

socket.on('spray_end', () => {
    isSpraying = false;
    stationaryTime = 0;
});

socket.on('update_settings', (data) => {
    if (data.color) currentColor = data.color;
    if (data.size) currentSize = parseInt(data.size);
});

socket.on('recenter', () => {
    // Logic handled on phone mostly to reset its offset.
    // But we can reset cursor to center here if we want to force it.
    cursor.x = width / 2;
    cursor.y = height / 2;
});

// Gallery Save
// We can trigger this from the console or wait for a specific event from phone
socket.on('save_image_request', () => {
    const dataURL = canvas.toDataURL('image/png');
    socket.emit('save_image', { room: roomId, image: dataURL });
    alert('Masterpiece Saved to Gallery!');
});
