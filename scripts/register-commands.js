const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

// Enable debug mode via command-line argument (--debug) or environment variable (DEBUG=true)
const isDebug = process.env.DEBUG === 'true' || process.argv.includes('--debug');

function logDebug(section, data) {
    if (!isDebug) return;
    console.log(`\n🔍 [DEBUG - ${section.toUpperCase()}]`);
    if (typeof data === 'object') {
        console.dir(data, { depth: null, colors: true });
    } else {
        console.log(data);
    }
}

const commands = [];
const commandsPath = path.join(__dirname, '../src/commands');

console.log('🚀 Initializing Command Deployment Engine...');
logDebug('Commands Path', commandsPath);

if (!fs.existsSync(commandsPath)) {
    console.error(`❌ ERROR: Directory not found at path: ${commandsPath}`);
    process.exit(1);
}

const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
logDebug('Discovered Command Files', commandFiles);

let loadedCount = 0;
let skippedCount = 0;

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
        // Clear module cache to force clean imports during debug runs
        delete require.cache[require.resolve(filePath)];
        const command = require(filePath);

        if ('data' in command && 'execute' in command) {
            const commandJSON = command.data.toJSON();
            commands.push(commandJSON);
            loadedCount++;
            console.log(`  ✅ Loaded command: /${command.data.name} (${file})`);
            logDebug(`Payload: /${command.data.name}`, commandJSON);
        } else {
            skippedCount++;
            console.warn(`  ⚠️ [WARNING] "${file}" is missing a required "data" or "execute" export.`);
        }
    } catch (err) {
        skippedCount++;
        console.error(`  ❌ [ERROR] Failed to load "${file}":`, err.message);
        if (isDebug) console.error(err.stack);
    }
}

console.log(`\n📦 Summary: ${loadedCount} command(s) loaded, ${skippedCount} file(s) skipped/failed.`);

const token = process.env.DISCORD_TOKEN || process.env.TOKEN;

if (!token) {
    console.error("❌ ERROR: No bot token found in your environment variables!");
    process.exit(1);
}

// Extract the Client ID directly from the Discord Token structure
const clientId = Buffer.from(token.split('.')[0], 'base64').toString('utf-8');
const guildId = process.env.PERSONNEL_GUILD_ID;

logDebug('Authentication Details', { clientId, guildId: guildId || 'GLOBAL' });

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`\nStarted refreshing ${commands.length} application (/) commands...`);

        if (guildId) {
            logDebug('REST Endpoint', `PUT -> Routes.applicationGuildCommands(${clientId}, ${guildId})`);
            
            const data = await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands },
            );

            console.log(`✅ Successfully reloaded ${data.length} guild application (/) commands.`);
            logDebug('Discord API Response', data);
        } else {
            console.warn("⚠️ No PERSONNEL_GUILD_ID set. Deploying GLOBALLY...");
            logDebug('REST Endpoint', `PUT -> Routes.applicationCommands(${clientId})`);

            const data = await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands },
            );

            console.log(`✅ Successfully reloaded ${data.length} global application (/) commands.`);
            logDebug('Discord API Response', data);
        }
    } catch (error) {
        console.error("\n❌ Failed to deploy commands:");
        console.error(`Status Code: ${error.status || 'N/A'}`);
