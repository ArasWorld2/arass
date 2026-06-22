const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config(); // Loads variables from your .env file

// 1. Configuration - Ensure these are set in your .env file
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID; // Your private/testing server ID
const token = process.env.DISCORD_TOKEN;

// SET THIS TO true FIRST TO CLEAR COOLDOWNS FROM THE MAIN SERVER, THEN SET TO false
const CLEAR_GLOBAL = true; 

const commands = [];
// Grab all the command files from your commands directory
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

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

(async () => {
    try {
        if (CLEAR_GLOBAL) {
            console.log('Started clearing accidental global application (/) commands...');
            
            // This sends an empty array to the global route, deleting them everywhere
            await rest.put(
                Routes.applicationCommands(clientId),
                { body: [] }
            );
            
            console.log('Successfully cleared global commands! Change CLEAR_GLOBAL to false to deploy to your guild.');
        } else {
            console.log(`Started refreshing ${commands.length} application (/) commands for Guild: ${guildId}...`);

            // This deploys them ONLY to your specific private server ID
            const data = await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands }
            );

            console.log(`Successfully reloaded ${data.length} application (/) commands locally!`);
        }
    } catch (error) {
        console.error(error);
    }
})();