const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import the Roblox Webhook Express Server
const { startWebServer } = require('./src/web/server');

// Initialize the Discord Client with required intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

// Setup Collection for Slash Commands
client.commands = new Collection();

// ==========================================
// 1. COMMAND HANDLER
// ==========================================
const commandsPath = path.join(__dirname, 'src', 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

// ==========================================
// 2. EVENT HANDLER
// ==========================================
const eventsPath = path.join(__dirname, 'src', 'events');
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
// 3. CLIENT READY EVENT & WEB SERVER INITIALIZATION
// ==========================================
client.once('ready', () => {
    console.log(`--------------------------------------------------`);
    console.log(`🤖 Logged in as: ${client.user.tag}`);
    console.log(`⚡ Connected to Discord API`);
    
    // Start the Express HTTP listener for Roblox :setflight and :so
    startWebServer(client);
    console.log(`--------------------------------------------------`);
});

// Global Unhandled Error Handling to prevent crashes
process.on('unhandledRejection', error => {
    console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('❌ Uncaught exception:', error);
});

// Log into Discord
client.login(process.env.DISCORD_TOKEN);