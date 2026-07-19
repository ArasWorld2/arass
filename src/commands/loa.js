    const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loa')
        .setDescription('Request a Leave of Absence'),

    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('loa_modal')
            .setTitle('Leave of Absence Request');

        const startDateInput = new TextInputBuilder()
            .setCustomId('loa_start')
            .setLabel('Start Date (DD/MM/YYYY)')
            .setPlaceholder('e.g. 15/07/2026')
            .setMinLength(10)
            .setMaxLength(10)
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const endDateInput = new TextInputBuilder()
            .setCustomId('loa_end')
            .setLabel('End Date (DD/MM/YYYY)')
            .setPlaceholder('e.g. 30/07/2026')
            .setMinLength(10)
            .setMaxLength(10)
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const reasonInput = new TextInputBuilder()
            .setCustomId('loa_reason')
            .setLabel('Reason')
            .setPlaceholder('Please describe your reason for leave...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(startDateInput),
            new ActionRowBuilder().addComponents(endDateInput),
            new ActionRowBuilder().addComponents(reasonInput)
        );

        await interaction.showModal(modal);
    }
};