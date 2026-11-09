const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const Allocation = require('../models/Allocation');
const { checkRole } = require('../utils/checkRole');
const embeds = require('../utils/embeds');

// Custom LOT Emojis
const EMOJIS = {
    TAIL: '<:LOTTail:1520114549490057226>',
    ARROW: '<:LOTSArrow:1520114515318935584>',
    HEART: '<:LOTSHeart:1520114525586849985>'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('allocation-lock')
        .setDescription('Admin: Lock or unlock allocation changes for a specific flight sheet')
        .addStringOption(option => 
            option.setName('flight_number')
                .setDescription('Select or search for an active flight from MongoDB')
                .setAutocomplete(true)
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option.setName('locked')
                .setDescription('True to lock allocations, False to unlock')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async autocomplete(interaction) {
        try {
            const focusedValue = (interaction.options.getFocused() || '').trim().toUpperCase();
            const query = focusedValue 
                ? { 'flight.number': { $regex: focusedValue, $options: 'i' } } 
                : {};

            const allocations = await Allocation.find(query).sort({ createdAt: -1 }).limit(10).lean();
            if (!allocations || allocations.length === 0) return await interaction.respond([]).catch(() => {});

            const choices = allocations.map(a => ({
                name: `${a.flight?.number || 'UNKNOWN'} (${a.flight?.from || '???'} ➔ ${a.flight?.to || '???'} | ${a.flight?.date || 'Today'})`,
                value: a.messageId
            }));

            await interaction.respond(choices).catch(() => {});
        } catch (err) {
            console.error('Autocomplete error in allocation-lock:', err);
            await interaction.respond([]).catch(() => {});
        }
    },

    async execute(interaction) {
        if (!await checkRole(interaction)) return;
        
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        try {
            const messageId = interaction.options.getString('flight_number');
            const isLocked = interaction.options.getBoolean('locked');

            // Find the specific flight document in MongoDB using its message ID
            const allocation = await Allocation.findOne({ messageId });

            if (!allocation) {
                return await interaction.editReply('❌ No flight allocation found matching that Message ID.');
            }

            // Set the lock status flag
            allocation.isLocked = isLocked;
            await allocation.save();

            const flightNum = allocation.flight?.number || 'Flight';

            // Refresh main Discord sheet embed in the channel
            try {
                const channel = await interaction.client.channels.fetch(allocation.channelId);
                const message = await channel.messages.fetch(messageId);
                
                if (embeds && typeof embeds.buildMainEmbed === 'function' && typeof embeds.buildButtons === 'function') {
                    await message.edit({
                        embeds: [embeds.buildMainEmbed(allocation.flight, allocation)],
                        components: embeds.buildButtons()
                    });
                }
            } catch (err) {
                console.warn('Could not edit flight sheet embed:', err.message);
            }

            const statusEmbed = new EmbedBuilder()
                .setColor('#0C2340') // LOT Navy Blue
                .setTitle(`${EMOJIS.TAIL} **LOT Polish Airlines • Timetable Security**`)
                .setDescription(
                    `${EMOJIS.ARROW} **Flight:** \`${flightNum}\`\n` +
                    `${EMOJIS.ARROW} **Status:** ${isLocked ? '🔒 **Locked** (Allocations Restricted)' : '🔓 **Unlocked** (Allocations Open)'}\n\n` +
                    `${EMOJIS.HEART} *The allocation list has been successfully ${isLocked ? 'locked' : 'unlocked'}.*`
                )
                .addFields(
                    { name: 'Flight Number', value: `\`${flightNum}\``, inline: true },
                    { name: 'Status', value: isLocked ? '🚫 Allocations Closed' : '✅ Allocations Open', inline: true }
                )
                .setFooter({ text: 'LOT Polish Airlines • Flight Operations' })
                .setTimestamp();

            await interaction.editReply({ embeds: [statusEmbed] });

            // Send log to staff log channel
            await sendLog(interaction, {
                action: isLocked ? '🔒 Timetable Locked' : '🔓 Timetable Unlocked',
                admin: interaction.user,
                flightNumber: flightNum,
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
