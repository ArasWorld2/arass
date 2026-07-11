const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();

// Load Commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
}

// Load Events
const eventsPath = path.join(__dirname, 'events');
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

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB database.'))
    .catch(err => console.error('MongoDB connection error:', err));

// Unified Ready & Command Sync Event
client.once('ready', async () => {
    console.log(`🤖 Logged in as ${client.user.tag}!`);

    try {
        const token = process.env.DISCORD_TOKEN || process.env.TOKEN;
        const rest = new REST().setToken(token);
        const commandJsonList = client.commands.map(cmd => cmd.data.toJSON());
        
        console.log('🧹 Clearing old global command cache to fix duplicates...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: [] } // Wipes the global cache clean
        );

        console.log(`Pushing ${client.commands.size} slash commands directly to the server guild...`);
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, process.env.PERSONNEL_GUILD_ID),
            { body: commandJsonList },
        );
        
        console.log('✅ Duplicates resolved! All application (/) commands successfully registered.');
    } catch (error) {
        console.error('❌ Automatic command registration failed:', error);
    }
});

client.login(process.env.DISCORD_TOKEN || process.env.TOKEN);