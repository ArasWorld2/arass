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
        delete require.cache[require.resolve(filePath)];

        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`[Command Loaded] /${command.data.name}`);
        } else {
            console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
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
// 3. READY EVENT & SERVER INITIALIZATION
// ==========================================
client.once(Events.ClientReady, () => {
    console.log(`--------------------------------------------------`);
    console.log(`🤖 Logged in as: ${client.user.tag}`);
    console.log(`⚡ Connected to Discord API`);
    
    // Start Express web listener for Roblox
    startWebServer(client);
    console.log(`--------------------------------------------------`);
});

// Global error handlers to prevent container crashes
process.on('unhandledRejection', error => {
    console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('❌ Uncaught exception:', error);
});

// ==========================================
// 4. DATABASE CONNECTION & BOT STARTUP
// ==========================================
async function startBot() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            console.error('❌ MONGODB_URI environment variable is missing in Railway!');
            return;
        }

        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB successfully.');

        console.log('🔄 Logging into Discord...');
        await client.login(process.env.DISCORD_TOKEN);
        
    } catch (err) {
        console.error('❌ Fatal Error during startup:', err);
    }
}

// Boot the application
startBot();