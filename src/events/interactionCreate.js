const { Events, MessageFlags } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        
        // ==========================================
        // 1. HANDLE ALLOCATION DROPDOWN INTERACTIONS
        // ==========================================
        if (interaction.isStringSelectMenu()) {
            try {
                // Acknowledge the choice immediately using modern flags to prevent crashes
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }).catch(() => {});

                // Find the main module responsible for processing dropdown submissions
                const postflight = interaction.client.commands.get('postflight');
                
                if (postflight && typeof postflight.handleDropdown === 'function') {
                    await postflight.handleDropdown(interaction);
                } else if (postflight && typeof postflight.execute === 'function') {
                    // Fallback to primary execute if logic is bundled directly
                    await postflight.execute(interaction);
                } else {
                    console.log("⚠️ Dropdown clicked, but 'postflight' command file handler could not be located.");
                    await interaction.editReply({ content: "❌ Allocation module failed to process this request." }).catch(() => {});
                }
            } catch (error) {
                console.error("❌ Error processing allocation dropdown:", error);
            }
            return; // Exit out early so it doesn't try to parse as a Slash Command
        }

        // ==========================================
        // 2. HANDLE SLASH COMMANDS (e.g., /unallocate)
        // ==========================================
        if (!interaction.isChatInputCommand()) return;

        const personnelGuildId = process.env.PERSONNEL_GUILD_ID;

        // Strict Guard Clause: Block admin slash execution outside the Personnel Server
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