const express = require('express');
const mongoose = require('mongoose');

let Allocation;
try {
    Allocation = require('../models/Allocation');
} catch (e) {
    console.warn('[Warning] Could not load Allocation model:', e.message);
}

const app = express();
app.use(express.json());

let activeFlightNumber = 'W61799';

function startWebServer(client) {
    const PORT = 8080;
    const SECRET_KEY = process.env.ROBLOX_SECRET_KEY || 'WizzAirSecretKey2026';

    // Health check
    app.get('/', (req, res) => {
        return res.status(200).send('OK - Roblox Webhook Server Online!');
    });

    // 1. SET FLIGHT
    app.post('/api/set-flight', (req, res) => {
        try {
            const { secret, flightNumber } = req.body || {};
            if (secret !== SECRET_KEY) {
                return res.status(200).json({ success: false, error: 'Unauthorized secret key' });
            }
            if (!flightNumber) {
                return res.status(200).json({ success: false, error: 'Missing flight number parameter' });
            }

            activeFlightNumber = String(flightNumber).trim().toUpperCase();
            console.log(`[Roblox API Success] Active flight updated to: ${activeFlightNumber}`);
            
            return res.status(200).json({ success: true, activeFlightNumber });
        } catch (err) {
            console.error('[Roblox API /set-flight Error]', err);
            return res.status(200).json({ success: false, error: err.message });
        }
    });

    // 2. SHOUTOUT
    app.post('/api/shoutout', async (req, res) => {
        try {
            const { secret } = req.body || {};
            if (secret !== SECRET_KEY) {
                return res.status(200).json({ success: false, error: 'Unauthorized secret key' });
            }

            const targetChannelId = process.env.SO_CHANNEL_ID;
            if (!targetChannelId) {
                return res.status(200).json({ success: false, error: 'SO_CHANNEL_ID is not configured on Railway.' });
            }

            let channel = client.channels?.cache.get(targetChannelId);
            if (!channel) {
                try {
                    channel = await client.channels.fetch(targetChannelId);
                } catch (fetchErr) {
                    return res.status(200).json({ 
                        success: false, 
                        error: `Bot cannot access channel ${targetChannelId}. Check permissions.` 
                    });
                }
            }

            if (!channel) {
                return res.status(200).json({ success: false, error: `Channel ID ${targetChannelId} does not exist.` });
            }

            let allocation = null;
            if (Allocation && mongoose.connection.readyState === 1) {
                try {
                    allocation = await Allocation.findOne({ 
                        'flight.number': { $regex: new RegExp(`^${activeFlightNumber}$`, 'i') } 
                    }).maxTimeMS(1000).exec();
                } catch (dbErr) {
                    console.warn('[MongoDB Warning] Query skipped:', dbErr.message);
                }
            }

            const flight = allocation?.flight || {};
            const flightNumStr = flight.number || activeFlightNumber || 'W61799';
            const departure = flight.departure || flight.from || 'Gdansk';
            const arrival = flight.arrival || flight.to || 'Tirana';

            // Updated Format with Full Wnewtail Emoji Tag
            const announcementText = 
`### <:suitcasewalk:1414277649395749046> Server Unlocked
-# <:blank:1296498991114227763> \`Fly Greenest\` <:flygreen:1272674839441965056>

> The server has **been unlocked** for all passengers travelling on flight <:Wnewtail:1272656069910462464> **${flightNumStr}** to **${arrival}** via **${departure}**. All passengers are now invited to join the flight server in preparation for departure.
<:arrow1:1414277637135925318> Please be advised that the server will remain open throughout the duration of the flight and passengers will be teleported directly onto the aircraft if they arrive too late. Should you require further information or support, please reach out to an on duty personnel.

-# <:link:1414278009573347328> **[Join Now](https://www.roblox.com/games/121134102391740/Gda-sk-Lech-Wa-sa-Airport)**
-# <:roblox:1414277676855857172> **[Roblox Group](<https://www.roblox.com/communities/16137621/w-zzair-rblx#!/about>)**`;

            await channel.send({ content: announcementText });
            console.log(`[Roblox API Success] Shoutout sent for flight ${flightNumStr}`);
            
            return res.status(200).json({ success: true, message: 'Shoutout sent successfully!' });

        } catch (err) {
            console.error('[Roblox API /shoutout Error]', err);
            return res.status(200).json({ success: false, error: err.message });
        }
    });

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🌐 Roblox Webhook API Server online on port ${PORT}`);
    });
}

module.exports = { startWebServer };