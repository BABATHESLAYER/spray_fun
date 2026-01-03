# Digital Graffiti Wall

Turn your smartphone into a virtual spray can and paint on your PC screen in real-time!

## Features

*   **Real-time Spraying**: Use your phone as a spray can. Tilt to aim, push to spray.
*   **Virtual Physics**: The spray behaves like real paint, with drips if you hold it in one spot too long.
*   **Audio & Haptics**: Feel the vibration and hear the hiss of the spray can (generated via Web Audio API, no external assets needed).
*   **Gallery System**: Save your masterpieces to the server and download them later.
*   **QR Code Connection**: Instantly connect your phone by scanning the QR code on the desktop screen.

## Prerequisites

*   **Node.js**: You need Node.js installed on your computer. Download it from [nodejs.org](https://nodejs.org/).
*   **Local Network**: Both your computer (hosting the wall) and your phone (the controller) must be on the **same Wi-Fi network**.

## Installation

1.  Open your terminal or command prompt.
2.  Navigate to the project folder.
3.  Install the dependencies:

    ```bash
    npm install
    ```

## Running the Application

1.  Start the server:

    ```bash
    node server.js
    ```

2.  The terminal will display the local network URL, for example:
    ```
    === Digital Graffiti Wall ===
    Server running at: http://localhost:3000
    Local Network URL: http://192.168.1.15:3000
    ```

## How to Play

1.  **Open the Wall**: On your computer, open your browser and go to `http://localhost:3000`. You will see a brick wall and a QR code.
2.  **Connect Phone**:
    *   Scan the QR code with your phone's camera.
    *   It will open the controller page (`/mobile`).
3.  **Calibrate**:
    *   Hold your phone comfortably pointing at the center of the screen.
    *   Tap **"Enable Sensors"** if prompted.
    *   Tap **"Recenter"** to calibrate the aim.
4.  **Paint**:
    *   Press and hold the big **"PUSH"** button to spray.
    *   Tilt your phone left/right/up/down to move the spray cursor.
    *   Use the **Color Picker** to change colors.
    *   Use the **Slider** to change nozzle size.
5.  **Save Art**:
    *   Tap **"Save Art"** on your phone.
    *   Visit `http://localhost:3000/gallery` on your computer to view and download your creations.

## Troubleshooting

*   **Sensors not working (iOS)**: iOS requires explicit permission for motion sensors and must be served over HTTPS in some contexts. If testing locally, ensure you tap "Allow" when asked for motion access.
*   **Connection issues**: Ensure both devices are on the exact same Wi-Fi network. Firewalls might block the connection; try allowing Node.js through your firewall.
