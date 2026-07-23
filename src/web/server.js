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

    // =========================================================================
    // SEED ENDPOINT (Direct Mongo Driver to avoid schema limits)
    // =========================================================================
    app.get('/api/seed', async (req, res) => {
        try {
            if (mongoose.connection.readyState !== 1) {
                return res.status(500).json({ success: false, error: 'MongoDB is not connected!' });
            }

            const db = mongoose.connection.db;
            const collection = db.collection('allocations');

            const sampleFlights = [
                {
                    messageId: "SEED-W61799",
                    flight: {
                        number: "W61799",
                        departure: "Gdansk",
                        arrival: "Tirana",
                        gameLink: "https://www.roblox.com/games/121134102391740/Gda-sk-Lech-Wa-sa-Airport"
                    }
                },
                {
                    messageId: "SEED-W45139",
                    flight: {
                        number: "W45139",
                        departure: "Tirana Nënë Tereza Airport",
                        arrival: "Paris Beauvais Airport",
                        gameLink: "https://www.roblox.com/games/90080052497848/Tirana-International-Airport-N-n-Tereza"
                    }
                },
                {
                    messageId: "SEED-W61301",
                    flight: {
                        number: "W61301",
                        departure: "Warsaw Chopin",
                        arrival: "Rome Fiumicino",
                        gameLink: "https://www.roblox.com/games/121134102391740/Warsaw-Chopin-Airport"
                    }
                }
            ];

            for (const item of sampleFlights) {
                await collection.updateOne(
                    { $or: [{ 'flight.number': item.flight.number }, { 'flightNumber': item.flight.number }] },
                    { $set: item },
                    { upsert: true }
                );
            }

            return res.status(200).json({ 
                success: true, 
                message: 'Successfully seeded 3 flights into allocations collection via Native Driver!' 
            });
        } catch (err) {
            console.error('[Seed Error]', err);
            return res.status(500).json({ success: false, error: err.message });
        }
    });

    // =========================================================================
    // 1. SET ACTIVE FLIGHT
    // =========================================================================
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

    // =========================================================================
    // 2. DISCORD ANNOUNCEMENT SHOUTOUT
    // =========================================================================
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

            // DIRECT MONGODB LOOKUP
            let doc = null;
            if (mongoose.connection.readyState === 1) {
                try {
                    const db = mongoose.connection.db;
                    const collections = await db.listCollections().toArray();
                    console.log('[Mongo DB Debug] Active collections in database:', collections.map(c => c.name));

                    const targetCollection = db.collection('allocations');
                    const searchRegex = new RegExp(`^${activeFlightNumber}$`, 'i');

                    doc = await targetCollection.findOne({
                        $or: [
                            { 'flight.number': searchRegex },
                            { 'flight.flightNumber': searchRegex },
                            { 'flightNumber': searchRegex }
                        ]
                    });

                    console.log(`[Mongo Search Debug] Querying for "${activeFlightNumber}" -> Found Doc:`, doc);
                } catch (dbErr) {
                    console.error('[MongoDB Lookup Error]', dbErr);
                }
            } else {
                console.warn('[MongoDB Warning] Connection state is not connected (readyState != 1)');
            }

            // Extract dynamic fields from the document
            const flight = doc?.flight || doc || {};
            const flightNumStr = flight.number || flight.flightNumber || activeFlightNumber || 'W61799';
            const departure = flight.departure || flight.from || flight.dep || 'Gdansk';
            const arrival = flight.arrival || flight.to || flight.arr || 'Tirana';
            const joinLink = flight.gameLink || flight.link || 'https://www.roblox.com/games/121134102391740/Gda-sk-Lech-Wa-sa-Airport';

            const announcementText = 
`### <:suitcasewalk:1414277649395749046> Server Unlocked
-# <:blank:1296498991114227763> \`Fly Greenest\` <:flygreen:1272674839441965056>

> The server has **been unlocked** for all passengers travelling on flight <:Wnewtail:1272656069910462464> **${flightNumStr}** to **${arrival}** via **${departure}**. All passengers are now invited to join the flight server in preparation for departure.
<:arrow1:1414277637135925318> Please be advised that the server will remain open throughout the duration of the flight and passengers will be teleported directly onto the aircraft if they arrive too late. Should you require further information or support, please reach out to an on duty personnel.

-# <:link:1414278009573347328> **[Join Now](${joinLink})**
-# <:roblox:1414277676855857172> **[Roblox Group](<https://www.roblox.com/communities/822510972/w-zzair-rblx#!/about>)**`;

            await channel.send({ content: announcementText });
            console.log(`[Roblox API Success] Shoutout sent for flight ${flightNumStr} (${departure} -> ${arrival})`);
            
            return res.status(200).json({ 
                success: true, 
                message: 'Shoutout sent successfully!',
                flight: { flightNumStr, departure, arrival, joinLink }
            });

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