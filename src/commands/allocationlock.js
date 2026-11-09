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
        .setDescription('Admin: Lock or unlock allocation changes for a specific flight sheet in MongoDB')
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

    // Dynamic autocomplete fetch directly from MongoDB
    async autocomplete(interaction) {
        try {
            const focusedValue = (interaction.options.getFocused() || '').trim().toUpperCase();
            const query = focusedValue 
                ? { 'flight.number': { $regex: focusedValue, $options: 'i' } } 
                : {};

            // Fetch top 10 matching flight allocations from MongoDB
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
        if (typeof checkRole === 'function' && !await checkRole(interaction)) return;
        
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        try {
            const messageId = interaction.options.getString('flight_number');
            const isLocked = interaction.options.getBoolean('locked');

            // 1. Fetch flight document directly from MongoDB
            const allocation = await Allocation.findOne({ messageId });

            if (!allocation) {
                return await interaction.editReply('❌ No flight allocation document found in MongoDB matching that sheet.');
            }

            // 2. Update and persist lock state in MongoDB
            allocation.isLocked = isLocked;
            await allocation.save();

            const flightNum = allocation.flight?.number || 'Flight';

            // 3. Re-render the active Discord message sheet with synced MongoDB state
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
                console.warn('Could not re-render flight sheet message embed:', err.message);
            }

            // 4. Send LOT-themed confirmation embed
            const statusEmbed = new EmbedBuilder()
                .setColor('#0C2340') // LOT Navy Blue
                .setTitle(`${EMOJIS.TAIL} **LOT Polish Airlines • Timetable Security**`)
                .setDescription(
                    `${EMOJIS.ARROW} **Flight:** \`${flightNum}\`\n` +
                    `${EMOJIS.ARROW} **Status:** ${isLocked ? '🔒 **Locked** (Allocations Restricted)' : '🔓 **Unlocked** (Allocations Open)'}\n\n` +
                    `${EMOJIS.HEART} *MongoDB database record successfully updated.*`
                )
                .addFields(
                    { name: 'Flight Number', value: `\`${flightNum}\``, inline: true },
                    { name: 'Message ID', value: `\`${messageId}\``, inline: true },
                    { name: 'Database Status', value: isLocked ? '🚫 Allocations Closed' : '✅ Allocations Open', inline: true }
                )
                .setFooter({ text: 'LOT Polish Airlines • Flight Operations' })
                .setTimestamp();

            await interaction.editReply({ embeds: [statusEmbed] });

            // 5. Forward log entry
            await sendLog(interaction, {
                action: isLocked ? '🔒 Timetable Locked (DB Updated)' : '🔓 Timetable Unlocked (DB Updated)',
                admin: interaction.user,
                flightNumber: flightNum,
                messageId
            });

        } catch (error) {
            console.error('❌ Error executing /allocation-lock:', error);
            await interaction.editReply(`❌ Failed to update MongoDB lock state: \`${error.message}\``);
        }
    },
};

// Log forwarding helper
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
