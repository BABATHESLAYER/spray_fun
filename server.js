const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from public directory
app.use(express.static('public'));

// Ensure gallery directory exists
const galleryDir = path.join(__dirname, 'public/gallery');
if (!fs.existsSync(galleryDir)){
    fs.mkdirSync(galleryDir, { recursive: true });
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/mobile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/mobile.html'));
});

// Gallery Route - Generate gallery page dynamically
app.get('/gallery', (req, res) => {
    const galleryPath = path.join(__dirname, 'public/gallery');

    fs.readdir(galleryPath, (err, files) => {
        if (err) {
            console.error('Error reading gallery:', err);
            return res.status(500).send('Error reading gallery');
        }

        const images = files.filter(file => file.endsWith('.png') || file.endsWith('.jpg'));
        const imageGrid = images.map(img => `
            <div class="gallery-item">
                <img src="/gallery/${img}" alt="${img}">
                <a href="/gallery/${img}" download="${img}" class="download-btn">Download</a>
            </div>
        `).join('');

        const html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Graffiti Gallery</title>
                <style>
                    body { font-family: sans-serif; background: #222; color: white; padding: 20px; }
                    h1 { text-align: center; }
                    .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; padding: 20px; }
                    .gallery-item { background: #333; padding: 10px; border-radius: 8px; text-align: center; }
                    .gallery-item img { max-width: 100%; border-radius: 4px; border: 2px solid #555; }
                    .download-btn { display: inline-block; margin-top: 10px; padding: 8px 16px; background: #e91e63; color: white; text-decoration: none; border-radius: 4px; }
                    .download-btn:hover { background: #c2185b; }
                    .empty { text-align: center; margin-top: 50px; color: #777; }
                </style>
            </head>
            <body>
                <h1>Graffiti Gallery</h1>
                ${images.length ? `<div class="gallery">${imageGrid}</div>` : '<div class="empty">No artworks yet. Go paint something!</div>'}
                <div style="text-align:center; margin-top:20px;"><a href="/" style="color:#aaa;">Back to Wall</a></div>
            </body>
            </html>
        `;
        res.send(html);
    });
});

// Socket.io Logic
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Join a room (simple logic: creating a room based on ID or default)
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);
        // Notify others that a new peer joined (e.g., mobile controller connected)
        socket.to(roomId).emit('peer_joined');
    });

    // Mobile -> Desktop events
    socket.on('tilt', (data) => {
        // data contains { beta, gamma, alpha } or processed coordinates
        socket.to(data.room).emit('update_cursor', data);
    });

    socket.on('spray_start', (data) => {
        socket.to(data.room).emit('spray_start', data);
    });

    socket.on('spray_end', (data) => {
        socket.to(data.room).emit('spray_end', data);
    });

    socket.on('update_settings', (data) => {
        // data: { color, size }
        socket.to(data.room).emit('update_settings', data);
    });

    socket.on('recenter', (data) => {
        socket.to(data.room).emit('recenter', data);
    });

    // Relay Save Request (Mobile -> Desktop)
    socket.on('save_image_request', (data) => {
        socket.to(data.room).emit('save_image_request', data);
    });

    // Save Image Handler
    socket.on('save_image', (data) => {
        // data: { room, image: 'base64string' }
        const base64Data = data.image.replace(/^data:image\/png;base64,/, "");
        const filename = `graffiti_${Date.now()}.png`;
        const filepath = path.join(__dirname, 'public/gallery', filename);

        fs.writeFile(filepath, base64Data, 'base64', (err) => {
            if (err) {
                console.error('Error saving image:', err);
            } else {
                console.log(`Image saved: ${filename}`);
                // Notify the desktop/mobile that save was successful (optional)
            }
        });
    });

    // Handle request for server IP
    socket.on('get_server_ip', () => {
        const interfaces = os.networkInterfaces();
        let bestIp = '';

        // Find best guess IP (prioritize 192.168.x.x)
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if ('IPv4' !== iface.family || iface.internal) {
                    continue;
                }
                if (iface.address.startsWith('192.168.')) {
                    bestIp = iface.address;
                } else if (!bestIp) {
                    bestIp = iface.address;
                }
            }
        }
        socket.emit('server_ip', { ip: bestIp || 'localhost' });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if ('IPv4' !== iface.family || iface.internal) {
                continue;
            }
            addresses.push({ name, address: iface.address });
        }
    }

    console.log(`\n=== Digital Graffiti Wall ===`);
    console.log(`Server running at: http://localhost:${PORT}`);

    if (addresses.length > 0) {
        console.log(`\nAvailable Network Interfaces:`);
        addresses.forEach(addr => {
            console.log(` - ${addr.name}: http://${addr.address}:${PORT}`);
        });
        console.log(`\nUse the address that matches your WiFi network (usually 192.168.x.x).`);
    } else {
        console.log(`Local Network URL: http://localhost:${PORT}`);
    }

    console.log(`To connect mobile, scan the QR code on the desktop screen.`);
    console.log(`=============================\n`);
});
