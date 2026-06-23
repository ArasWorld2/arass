const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Only process slash commands
        if (!interaction.isChatInputCommand()) return;

        const personnelGuildId = process.env.PERSONNEL_GUILD_ID;

        // Strict Guard Clause: Block execution outside the Personnel Server
        if (interaction.guildId !== personnelGuildId) {
            return await interaction.reply({
                content: '⚠️ This command is restricted and cannot be used here.',
                ephemeral: true // Only the person clicking sees this error message
            });
        }

        // Fetch the command from the bot's collection
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