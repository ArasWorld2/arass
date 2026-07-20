const express = require('express');
const Allocation = require('../models/Allocation'); 

const app = express();
app.use(express.json());

let activeFlightNumber = 'W61799';

function startWebServer(client) {
    const PORT = process.env.PORT || 3000;
    const SECRET_KEY = process.env.ROBLOX_SECRET_KEY || 'WizzAirSecretKey2026';

    // Health check endpoint
    app.get('/', (req, res) => {
        res.send('OK - Roblox Webhook Server Online!');
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

        const mainGuildId = process.env.GUILD_ID;
        const targetChannelId = process.env.SO_CHANNEL_ID;

        if (!targetChannelId) {
            console.error('[Roblox API Error] SO_CHANNEL_ID variable missing');
            return res.status(500).json({ error: 'SO_CHANNEL_ID is not set.' });
        }

        try {
            // Fetch channel directly
            const channel = await client.channels.fetch(targetChannelId).catch(err => {
                console.error('[Discord Fetch Error]', err);
                return null;
            });

            if (!channel) {
                return res.status(404).json({ error: `Could not fetch channel ID ${targetChannelId}` });
            }

            // Search MongoDB with a strict 3-second timeout safety net
            let allocation = null;
            try {
                allocation = await Allocation.findOne({ 
                    'flight.number': { $regex: new RegExp(`^${activeFlightNumber}$`, 'i') } 
                }).maxTimeMS(3000);
            } catch (dbErr) {
                console.warn('[MongoDB Timeout/Error] Using default fallback values:', dbErr.message);
            }

            const flight = allocation?.flight || {};

            // Dynamic fields with fallbacks
            const flightNumStr = flight.number || activeFlightNumber || 'W6 1799';
            const departure = flight.departure || flight.from || 'Gdańsk Lech Wałęsa Airport';
            const arrival = flight.arrival || flight.to || 'Tirana International Airport Nënë Tereza';

            // Custom Formatted Announcement
            const announcementText = 
`### <:suitcasewalk:1414277649395749046> Server Unlocked
-# :blank: \`Fly Greenest\` :flygreen:

> The server has **been unlocked** for all passengers travelling on flight :Wnewtail: **${flightNumStr}** to **${arrival}** via **${departure}**. All passengers are now invited to join the flight server in preparation for departure.
<:arrow1:1414277637135925318> Please be advised that the server will remain open throughout the duration of the flight and passengers will be teleported directly onto the aircraft if they arrive too late. Should you require further information or support, please reach out to an on duty personnel.

-# <:link:1414278009573347328> **[Join Now](https://www.roblox.com/games/121134102391740/Gda-sk-Lech-Wa-sa-Airport)**
-# <:roblox:1414277676855857172> **[Roblox Group](<https://www.roblox.com/communities/16137621/w-zzair-rblx#!/about>)**`;

            await channel.send({ content: announcementText });

            console.log(`[Roblox API Success] Shoutout sent for ${flightNumStr}!`);
            return res.json({ success: true, message: 'Shoutout posted successfully!' });

        } catch (err) {
            console.error('[Roblox API Error]', err);
            return res.status(500).json({ error: err.message });
        }
    });

    // Explicit binding to 0.0.0.0
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🌐 Roblox Webhook API Server online on port ${PORT}`);
    });
}

module.exports = { startWebServer };