const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const Allocation = require('../models/Allocation'); // Adjust path to your allocation model if needed
const { checkRole } = require('../utils/checkRole');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('allocation-lock')
        .setDescription('Admin: Lock or unlock allocation changes for a timetable channel')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('The timetable channel to lock/unlock')
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option.setName('locked')
                .setDescription('True to lock allocations, False to unlock')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        if (!await checkRole(interaction)) return;
        
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        try {
            const targetChannel = interaction.options.getChannel('channel');
            const isLocked = interaction.options.getBoolean('locked');

            // Update all active allocations matching this channel ID in MongoDB
            const result = await Allocation.updateMany(
                { channelId: targetChannel.id },
                { $set: { isLocked: isLocked } }
            );

            const statusEmbed = new EmbedBuilder()
                .setColor('#d3007f')
                .setTitle(isLocked ? '🔒 Timetable Allocation Locked' : '🔓 Timetable Allocation Unlocked')
                .setDescription(`All flight allocations inside ${targetChannel} have been successfully ${isLocked ? '**locked**' : '**unlocked**'}.`)
                .addFields(
                    { name: 'Target Channel', value: `${targetChannel.name} (\`${targetChannel.id}\`)`, inline: true },
                    { name: 'Impacted Records', value: `\`${result.modifiedCount}\` flight(s)`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Wizz Air Operations • Security Override' });

            await interaction.editReply({ embeds: [statusEmbed] });

        } catch (error) {
            console.error('❌ Error executing /allocation-lock:', error);
            await interaction.editReply(`❌ Failed to alter allocation lock states: \`${error.message}\``);
        }
    },
};