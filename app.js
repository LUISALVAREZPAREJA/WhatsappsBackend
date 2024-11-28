const express = require('express');
const cors = require('cors');
const { createBot, createProvider, createFlow } = require('@bot-whatsapp/bot');
const QRPortalWeb = require('@bot-whatsapp/portal');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
const MockAdapter = require('@bot-whatsapp/database/mock');
const multer = require('multer'); // For handling file uploads
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));;
app.use(express.json({ limit: '10kb' })); // Set request body limit to 10KB
app.use(express.urlencoded({ extended: true })); // For handling URL-encoded data

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb){
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb){
       cb(null, 'gato' + path.extname(file.originalname));
    }
});

const upload = multer({storage: storage});

// Create the provider and save the reference
const adapterDB = new MockAdapter();
const adapterProvider = createProvider(BaileysProvider);
const adapterFlow = createFlow([]); // Add your flows here

// Create the bot
const bot = createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
});

// Variable to control the message-sending state
let sendingMessages = false;

// Define the route to send messages with an optional file attachment
app.post('/send-message', upload.single('file'), async (req, res) => {
    const { message, numbers } = req.body;
    const file = req.file; // Get the uploaded file (optional)

    // Verifica si se subió un archivo y construye el objeto media
    let media;
    if (file) {
        media = {
            type: 'image', 
            path: file.path, // Usa la ruta del archivo subido
            mimetype: file.mimetype // Incluye el mimetype
        };
    }

    // Check if the message and numbers are valid
    if (!message || !Array.isArray(numbers) || numbers.length === 0) {
        return res.status(400).json({ status: 'error', message: 'Invalid message or numbers' });
    }

    sendingMessages = true; // Mark that messages are being sent

    try {
        // Create an array to store the sending promises
        const sendPromises = numbers.map(async (number) => {
            let formattedNumber = number.trim();
            if (!formattedNumber.startsWith('57')) {
                formattedNumber = '57' + formattedNumber;
            }

            const delay = Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000;
            await new Promise((resolve) => setTimeout(resolve, delay)); // Wait for the delay

            if (!sendingMessages) {
                return { number: formattedNumber, status: 'cancelled' };
            }

            if (media) {
                try {
                    const { type, path, mimetype } = media;
                    await adapterProvider.sendMessage(
                        formattedNumber + '@s.whatsapp.net',
                        { media: { type, path, mimetype } }
                    );
                    return { number: formattedNumber, status: 'file_sent' };
                } catch (sendError) {
                    return { number: formattedNumber, status: 'error', error: sendError.message };
                }
            }

            try {
                await adapterProvider.sendText(formattedNumber + '@s.whatsapp.net', message);
                return { number: formattedNumber, status: 'success' };
            } catch (sendError) {
                return { number: formattedNumber, status: 'error', error: sendError.message };
            }
        });

        const results = await Promise.allSettled(sendPromises);
        res.json({ status: 'success', results });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Error sending messages' });
    } finally {
        sendingMessages = false; // Mark that messages are no longer being sent
    }
});

// Endpoint to cancel message sending
app.post('/cancel-send', (req, res) => {
    if (sendingMessages) {
        sendingMessages = false;
        return res.json({ status: 'success', message: 'Message sending has been canceled.' });
    }
    return res.status(400).json({ status: 'error', message: 'No messages are being sent.' });
});

// Define a separate route for the QR portal
app.get('/qr', (req, res) => {
    QRPortalWeb(); // This will handle the QR code in this route
    res.send('QR Portal running at /qr'); // Placeholder response
});

// Start the server
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Error handling for the server
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`El puerto ${PORT} ya está en uso.`);
    } else {
        console.error(`Error en el servidor: ${error.message}`);
    }
});
