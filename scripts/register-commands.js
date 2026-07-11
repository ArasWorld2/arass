const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        
        // ==========================================
        // 1. HANDLE DROPDOWN MENU INTERACTIONS
        // ==========================================
        if (interaction.isStringSelectMenu()) {
            try {
                // 1. Instantly defer to stop the 3-second timeout crash
                await interaction.deferUpdate().catch(() => {});

                // 2. Route the interaction to your unallocate or postflight system
                // Depending on how your bot handles custom IDs (e.g., 'allocate_role')
                const commandName = interaction.customId.includes('unallocate') ? 'unallocate' : 'postflight';
                const command = interaction.client.commands.get(commandName);
                
                if (command && typeof command.executeDropdown === 'function') {
                    await command.executeDropdown(interaction);
                } else if (command) {
                    await command.execute(interaction);
                } else {
                    console.log(`[Interaction Warning] Dropdown clicked, but no command handler found for: ${commandName}`);
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
                ephemeral: true 
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
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    },
};