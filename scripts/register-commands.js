const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const commands = [];
const commandsPath = path.join(__dirname, '../src/commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`Loaded command: /${command.data.name}`);
    }
}

const token = process.env.DISCORD_TOKEN || process.env.TOKEN;

if (!token) {
    console.error("❌ ERROR: No bot token found in your environment variables!");
    process.exit(1);
}

// Extract the Client ID directly from the Discord Token structure
const clientId = Buffer.from(token.split('.')[0], 'base64').toString('utf-8');
const guildId = process.env.PERSONNEL_GUILD_ID;

const rest = new REST().setToken(token);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands...`);

        // Deploy to your personnel guild server
        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );

        console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error("❌ Failed to deploy commands:", error);
    }
})();