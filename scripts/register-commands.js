const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

// Ensure all environment variables exist
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const personnelGuildId = process.env.PERSONNEL_GUILD_ID; // Add this to your Railway variables!

if (!token || !clientId || !personnelGuildId) {
    console.error('❌ Missing environment variables. Check DISCORD_TOKEN, CLIENT_ID, and PERSONNEL_GUILD_ID.');
    process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, '../src/commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

const rest = new REST().setToken(token);

(async () => {
    try {
        console.log(`🔄 Started refreshing ${commands.length} application (/) commands.`);

        // 1. CLEAR GLOBAL COMMANDS (Removes them from the calendar/passenger server)
        console.log('🧹 Clearing any existing global commands...');
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: [] }
        );

        // 2. REGISTER GUILD COMMANDS (Restricts them strictly to the Personnel Server)
        console.log(`📦 Deploying commands to Personnel Guild ID: ${personnelGuildId}`);
        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, personnelGuildId),
            { body: commands }
        );

        console.log(`✅ Successfully reloaded ${data.length} application (/) commands for the Personnel server only!`);
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
    }
})();