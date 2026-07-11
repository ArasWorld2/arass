const { Events, MessageFlags } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        
        // ==========================================
        // 1. HANDLE ALLOCATION DROPDOWN INTERACTIONS
        // ==========================================
        if (interaction.isStringSelectMenu()) {
            try {
                // Find the postflight command module
                const postflight = interaction.client.commands.get('postflight');
                
                if (postflight && typeof postflight.execute === 'function') {
                    // DO NOT defer here anymore. Let postflight.js handle its own defer/reply!
                    await postflight.execute(interaction);
                } else {
                    console.log("⚠️ Dropdown clicked, but 'postflight' handler could not be executed.");
                }
            } catch (error) {
                console.error("❌ Error processing allocation dropdown:", error);
            }
            return; 
        }

        // ==========================================
        // 2. HANDLE SLASH COMMANDS
        // ==========================================
        if (!interaction.isChatInputCommand()) return;

        const personnelGuildId = process.env.PERSONNEL_GUILD_ID;

        if (interaction.guildId !== personnelGuildId) {
            return await interaction.reply({
                content: '⚠️ This command is restricted and cannot be used here.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing ${interaction.commandName}:`, error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', flags: [MessageFlags.Ephemeral] });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', flags: [MessageFlags.Ephemeral] });
            }
        }
    },
};