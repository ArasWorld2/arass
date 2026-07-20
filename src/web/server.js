const express = require('express');
const mongoose = require('mongoose');
const Allocation = require('../models/Allocation'); 

const app = express();
app.use(express.json());

let activeFlightNumber = 'W61799';

function startWebServer(client) {
    const PORT = process.env.PORT || 3000;
    const SECRET_KEY = process.env.ROBLOX_SECRET_KEY || 'WizzAirSecretKey2026';

    // Health check endpoint
    app.get('/', (req, res) => {
        return res.send('OK - Roblox Webhook Server Online!');
    });

    // 1. Endpoint: Updates active flight number (:setflight <number>)
    app.post('/api/set-flight', (req, res) => {
        const { secret, flightNumber } = req.body;
        if (secret !== SECRET_KEY) return res.status(403).json({ error: 'Unauthorized key' });
        if (!flightNumber) return res.status(400).json({ error: 'Missing flight number parameter' });

        activeFlightNumber = flightNumber.trim().toUpperCase();
        console.log(`[Roblox API] Active flight set to: ${activeFlightNumber}`);
        return res.json({ success: true, activeFlightNumber });
    });

    // 2. Endpoint: Sends dynamic Discord shoutout (:so)
    app.post('/api/shoutout', async (req, res) => {
        const { secret } = req.body;
        if (secret !== SECRET_KEY) return res.status(403).json({ error: 'Unauthorized key' });

        const targetChannelId = process.env.SO_CHANNEL_ID;

        if (!targetChannelId) {
            console.error('[Roblox API Error] SO_CHANNEL_ID environment variable is missing.');
            return res.status(500).json({ error: 'SO_CHANNEL_ID is not configured on Railway.' });
        }

        try {
            // Fetch channel directly from cache/Discord API
            const channel = client.channels.cache.get(targetChannelId) || await client.channels.fetch(targetChannelId).catch(() => null);

            if (!channel) {
                console.error(`[Roblox API Error] Could not find Discord channel ID: ${targetChannelId}`);
                return res.status(404).json({ error: `Channel ID ${targetChannelId} could not be found.` });
            }

            let allocation = null;

            // ⚡ FAST DB CHECK: Only query if MongoDB is actively connected (readyState === 1)
            if (mongoose.connection.readyState === 1) {
                try {
                    allocation = await Allocation.findOne({ 
                        'flight.number': { $regex: new RegExp(`^${activeFlightNumber}$`, 'i') } 
                    }).maxTimeMS(2000);
                } catch (dbErr) {
                    console.warn('[MongoDB Warning] Query bypassed:', dbErr.message);
                }
            } else {
                console.warn('[MongoDB Warning] Database not connected. Using template fallback values.');
            }

            const flight = allocation?.flight || {};

            // Dynamic fields with fallbacks
            const flightNumStr = flight.number || activeFlightNumber || 'W6 1799';
            const departure = flight.departure || flight.from || 'Gdańsk Lech Wałęsa Airport';
            const arrival = flight.arrival || flight.to || 'Tirana International Airport Nënë Tereza';

            // Announcement Template
            const announcementText = 
`### <:suitcasewalk:1414277649395749046> Server Unlocked
-# :blank: \`Fly Greenest\` :flygreen:

> The server has **been unlocked** for all passengers travelling on flight :Wnewtail: **${flightNumStr}** to **${arrival}** via **${departure}**. All passengers are now invited to join the flight server in preparation for departure.
<:arrow1:1414277637135925318> Please be advised that the server will remain open throughout the duration of the flight and passengers will be teleported directly onto the aircraft if they arrive too late. Should you require further information or support, please reach out to an on duty personnel.

-# <:link:1414278009573347328> **[Join Now](https://www.roblox.com/games/121134102391740/Gda-sk-Lech-Wa-sa-Airport)**
-# <:roblox:1414277676855857172> **[Roblox Group](<https://www.roblox.com/communities/16137621/w-zzair-rblx#!/about>)**`;

            // Send message to Discord
            await channel.send({ content: announcementText });

            console.log(`[Roblox API Success] Sent shoutout for flight ${flightNumStr}!`);
            return res.json({ success: true, message: 'Shoutout sent successfully!' });

        } catch (err) {
            console.error('[Roblox API Error]', err);
            return res.status(500).json({ error: err.message });
        }
    });

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🌐 Roblox Webhook API Server online on port ${PORT}`);
    });
}

module.exports = { startWebServer };