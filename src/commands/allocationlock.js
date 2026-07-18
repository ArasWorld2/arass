const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Allocation = require('../models/Allocation');
const { checkRole } = require('../utils/checkRole');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('allocation-lock')
        .setDescription('Admin: Lock or unlock allocation changes for a specific flight sheet')
        .addStringOption(option => 
            option.setName('message_id')
                .setDescription('The Message ID of the flight sheet embed to lock/unlock')
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
        
        await interaction.deferReply({ ephemeral: true });

        try {
            const messageId = interaction.options.getString('message_id');
            const isLocked = interaction.options.getBoolean('locked');

            // Find the specific flight document in MongoDB using its message ID
            const allocation = await Allocation.findOne({ messageId });

            if (!allocation) {
                return await interaction.editReply('❌ No flight allocation found matching that Message ID.');
            }

            // Set the lock status flag
            allocation.isLocked = isLocked;
            await allocation.save();

            const statusEmbed = new EmbedBuilder()
                .setColor('#d3007f')
                .setTitle(isLocked ? '🔒 Flight Sheet Locked' : '🔓 Flight Sheet Unlocked')
                .setDescription(`The flight sheet for **Flight ${allocation.flight?.number || 'Unknown'}** has been successfully ${isLocked ? '**locked**' : '**unlocked**'}.`)
                .addFields(
                    { name: 'Flight Number', value: `\`${allocation.flight?.number || 'N/A'}\``, inline: true },
                    { name: 'Message ID', value: `\`${messageId}\``, inline: true },
                    { name: 'Status', value: isLocked ? '🚫 Allocations Closed' : '✅ Allocations Open', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Wizz Air Operations • Timetable Security' });

            await interaction.editReply({ embeds: [statusEmbed] });

            // 🌟 Send log to staff log channel
            await sendLog(interaction, {
                action: isLocked ? '🔒 Timetable Locked' : '🔓 Timetable Unlocked',
                admin: interaction.user,
                flightNumber: allocation.flight?.number || 'Unknown',
                messageId
            });

        } catch (error) {
            console.error('❌ Error executing /allocation-lock:', error);
            await interaction.editReply(`❌ Failed to update flight lock state: \`${error.message}\``);
        }
    },
};

// Helper function to process logs consistently across operations commands
async function sendLog(interaction, { action, admin, flightNumber, messageId }) {
    const logChannelId = process.env.LOG_CHANNEL_ID;
    if (!logChannelId) return;
    try {
        const channel = await interaction.client.channels.fetch(logChannelId);
        await channel.send(`${action} | **Flight ${flightNumber}** | By: <@${admin.id}> | [Jump](https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${messageId})`);
    } catch (err) {
        console.warn('Could not send allocation-lock command log:', err.message);
    }
}