const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 💡 Fixed import path (relative to src/)
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
client.once('ready', () => {
    console.log(`--------------------------------------------------`);
    console.log(`🤖 Logged in as: ${client.user.tag}`);
    console.log(`⚡ Connected to Discord API`);
    
    // Start Express web listener
    startWebServer(client);
    console.log(`--------------------------------------------------`);
});

// Global error handlers to keep container alive
process.on('unhandledRejection', error => {
    console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('❌ Uncaught exception:', error);
});

// Connect to Discord
client.login(process.env.DISCORD_TOKEN);