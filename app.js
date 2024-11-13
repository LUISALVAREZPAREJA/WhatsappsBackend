const express = require('express');
const cors = require('cors');
const { createBot, createProvider, createFlow } = require('@bot-whatsapp/bot');
const QRPortalWeb = require('@bot-whatsapp/portal');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
const MockAdapter = require('@bot-whatsapp/database/mock');
const multer = require('multer'); // For handling file uploads
const Papa = require('papaparse'); // For processing CSV files
const cleanOldSessions = require('./sessionCleaner'); // Session cleaner function
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors({ origin: 'https://whatsappsfrontend.vercel.app' }));
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

// Set an interval to execute cleanOldSessions every 24 hours
//setInterval(cleanOldSessions, 5 * 60 * 1000); // Every 5 minutes

// Variable to control the message-sending state
let sendingMessages = false;

// Define the route to send messages with an optional file attachment
app.post('/send-message', upload.single('file'), async (req, res) => {
    console.log('Request body:', req.body); // Log the incoming request body
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

    console.log('Message received:', message, 'for numbers:', numbers);
    sendingMessages = true; // Mark that messages are being sent

    try {
        // Create an array to store the sending promises
        const sendPromises = numbers.map(async (number) => {
            let formattedNumber = number.trim();
            // Add the country code 57 if not present
            if (!formattedNumber.startsWith('57')) {
                formattedNumber = '57' + formattedNumber;
            }

            const delay = Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000;
            await new Promise((resolve) => setTimeout(resolve, delay)); // Wait for the delay

            // Check if the sending has been canceled
            if (!sendingMessages) {
                console.log('Sending has been canceled.');
                return { number: formattedNumber, status: 'cancelled' };
            }

            // Si se proporciona un archivo, envíalo
            if (media) {
                try {
                    // Desestructuramos media aquí
                    const { type, path, mimetype } = media; // Desestructuración
                    await adapterProvider.sendMessage(
                        formattedNumber + '@s.whatsapp.net',
                        { media: { type, path, mimetype } } // Pasamos media de forma desestructurada
                    );
                    console.log(`File sent to ${formattedNumber}`);
                    return { number: formattedNumber, status: 'file_sent' };
                } catch (sendError) {
                    console.error(`Error sending file to ${formattedNumber}:`, sendError.message);
                    return { number: formattedNumber, status: 'error', error: sendError.message };
                }
            }

            // Si no hay archivo, solo envía el mensaje de texto
            try {
                await adapterProvider.sendText(formattedNumber + '@s.whatsapp.net', message);
                console.log(`Message sent to ${formattedNumber} after ${delay / 1000} seconds`);
                return { number: formattedNumber, status: 'success' };
            } catch (sendError) {
                console.error(`Error sending message to ${formattedNumber}:`, sendError.message);
                return { number: formattedNumber, status: 'error', error: sendError.message };
            }
        });

        // Espera a que se resuelvan todas las promesas
        const results = await Promise.allSettled(sendPromises);
        res.json({ status: 'success', results });
    } catch (error) {
        console.error('Error processing message sending:', error);
        res.status(500).json({ status: 'error', message: 'Error sending messages' });
    } finally {
        sendingMessages = false; // Mark that messages are no longer being sent
    }
});

// Endpoint to cancel message sending
app.post('/cancel-send', (req, res) => {
    if (sendingMessages) {
        sendingMessages = false; // Change the state to stop sending
        console.log('Message sending has been canceled.');
        return res.json({ status: 'success', message: 'Message sending has been canceled.' });
    }
    return res.status(400).json({ status: 'error', message: 'No messages are being sent.' });
});

// Start the QR Portal
//QRPortalWeb();

// Start the server
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Manejo de errores para el servidor
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`El puerto ${PORT} ya está en uso.`);
        // Aquí puedes decidir si salir o intentar otro puerto
    } else {
        console.error(`Error en el servidor: ${error.message}`);
    }
});
