const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Roblox Webhook Server
const { startWebServer } = require('./web/server');

// Initialize the Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();

// ==========================================
// 1. COMMAND HANDLER
// ==========================================
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        }
    }
}

// ==========================================
// 2. EVENT HANDLER
// ==========================================
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
    }
}

// ==========================================
// 3. READY EVENT
// ==========================================
client.once(Events.ClientReady, () => {
    console.log(`--------------------------------------------------`);
    console.log(`🤖 Logged in as: ${client.user.tag}`);
    console.log(`⚡ Connected to Discord API`);
    console.log(`--------------------------------------------------`);
});

// Global error handlers
process.on('unhandledRejection', error => console.error('❌ Unhandled rejection:', error));
process.on('uncaughtException', error => console.error('❌ Uncaught exception:', error));

// ==========================================
// 4. APPLICATION STARTUP
// ==========================================
async function startBot() {
    // ⚡ STEP A: START EXPRESS IMMEDIATELY (Fixes 10ms 502 error)
    startWebServer(client);

    // ⚡ STEP B: CONNECT TO MONGODB
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (mongoUri) {
            console.log('🔄 Connecting to MongoDB...');
            await mongoose.connect(mongoUri);
            console.log('✅ Connected to MongoDB successfully.');
        } else {
            console.warn('⚠️ MONGODB_URI missing. Skipping DB connection.');
        }
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err.message);
    }

    // ⚡ STEP C: LOG INTO DISCORD
    try {
        console.log('🔄 Logging into Discord...');
        await client.login(process.env.DISCORD_TOKEN);
    } catch (err) {
        console.error('❌ Discord Login Error:', err.message);
    }
}

startBot();