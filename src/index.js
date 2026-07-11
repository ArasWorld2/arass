const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
require('dotenv').config();

// 1. Initialize Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();

// 2. Load Commands Dynamically
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
}

// 3. Load Events Dynamically
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

// 4. Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB database.'))
    .catch(err => console.error('MongoDB connection error:', err));

// 5. Unified Ready & Command Sync Event
client.once('ready', async () => {
    console.log(`🤖 Logged in as ${client.user.tag}!`);

    try {
        console.log(`Pushing ${client.commands.size} slash commands directly from Railway environment...`);
        const token = process.env.DISCORD_TOKEN || process.env.TOKEN;
        const rest = new REST().setToken(token);
        
        const commandJsonList = client.commands.map(cmd => cmd.data.toJSON());
        
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, process.env.PERSONNEL_GUILD_ID),
            { body: commandJsonList },
        );
        
        console.log('✅ All application (/) commands successfully registered on Discord!');
    } catch (error) {
        console.error('❌ Automatic command registration failed:', error);
    }
});

// 6. Login Bot
client.login(process.env.DISCORD_TOKEN || process.env.TOKEN);