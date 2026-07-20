const express = require('express');
const Allocation = require('../models/Allocation'); 

const app = express();
app.use(express.json());

let activeFlightNumber = 'W61799';

function startWebServer(client) {
    const PORT = process.env.PORT || 3000;
    const SECRET_KEY = process.env.ROBLOX_SECRET_KEY || 'WizzAirSecretKey2026';

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

        if (!mainGuildId || !targetChannelId) {
            console.error('[Roblox API Error] GUILD_ID or SO_CHANNEL_ID variable is missing in environment settings.');
            return res.status(500).json({ error: 'GUILD_ID or SO_CHANNEL_ID environment variable is not set on Railway.' });
        }

        try {
            // 🏰 1. Fetch the server using GUILD_ID
            const guild = await client.guilds.fetch(mainGuildId).catch(() => null);
            if (!guild) {
                return res.status(404).json({ error: `Guild ID ${mainGuildId} could not be found by the bot.` });
            }

            // 📢 2. Fetch the channel inside that guild using SO_CHANNEL_ID
            const channel = await guild.channels.fetch(targetChannelId).catch(() => null);
            if (!channel) {
                return res.status(404).json({ error: `Channel ID ${targetChannelId} could not be found inside server "${guild.name}".` });
            }

            // Search MongoDB for flight details matching activeFlightNumber
            const allocation = await Allocation.findOne({ 
                'flight.number': { $regex: new RegExp(`^${activeFlightNumber}$`, 'i') } 
            });

            const flight = allocation?.flight || {};

            // Dynamic fields with fallbacks
            const flightNumStr = flight.number || 'W6 1799';
            const departure = flight.departure || flight.from || 'Gdańsk Lech Wałęsa Airport';
            const arrival = flight.arrival || flight.to || 'Tirana International Airport Nënë Tereza';

            // Custom Formatted Text Block
            const announcementText = 
`### <:suitcasewalk:1414277649395749046> Server Unlocked
-# :blank: \`Fly Greenest\` :flygreen:

> The server has **been unlocked** for all passengers travelling on flight :Wnewtail: **${flightNumStr}** to **${arrival}** via **${departure}**. All passengers are now invited to join the flight server in preparation for departure.
<:arrow1:1414277637135925318> Please be advised that the server will remain open throughout the duration of the flight and passengers will be teleported directly onto the aircraft if they arrive too late. Should you require further information or support, please reach out to an on duty personnel.

-# <:link:1414278009573347328> **[Join Now](https://www.roblox.com/games/121134102391740/Gda-sk-Lech-Wa-sa-Airport)**
-# <:roblox:1414277676855857172> **[Roblox Group](<https://www.roblox.com/communities/16137621/w-zzair-rblx#!/about>)**`;

            await channel.send({ content: announcementText });

            console.log(`[Roblox API Success] Announcement posted to #${channel.name} in ${guild.name}`);
            return res.json({ 
                success: true, 
                message: `Server Unlocked shoutout sent to #${channel.name} inside ${guild.name}!` 
            });

        } catch (err) {
            console.error('[Roblox API Error]', err);
            return res.status(500).json({ error: err.message });
        }
    });

    app.listen(PORT, () => {
        console.log(`🌐 Roblox Webhook API Server online on port ${PORT}`);
    });
}

module.exports = { startWebServer };