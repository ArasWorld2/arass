const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const Allocation = require('../models/Allocation');
const { checkRole } = require('../utils/checkRole');

// Custom LOT Emojis & Theme Color
const EMOJIS = {
    TAIL: '<:LOTTail:1520114549490057226>',
    ARROW: '<:LOTSArrow:1520114515318935584>'
};
const LOT_NAVY = '#0C2340';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remind')
        .setDescription('Send a DM reminder to all allocated staff on a flight')
        .addStringOption(o => 
            o.setName('message_id')
                .setDescription('Select or search for the flight allocation sheet (defaults to latest in channel)')
                .setAutocomplete(true)
                .setRequired(false)
        )
        .addStringOption(o => 
            o.setName('message')
                .setDescription('Custom message to include (optional)')
                .setRequired(false)
        ),

    async autocomplete(interaction) {
        try {
            const focusedValue = (interaction.options.getFocused() || '').trim().toUpperCase();
            const query = focusedValue ? { 'flight.number': { $regex: focusedValue, $options: 'i' } } : {};
            const allocations = await Allocation.find(query).sort({ createdAt: -1 }).limit(10).lean();

            if (!allocations || allocations.length === 0) return await interaction.respond([]).catch(() => {});

            const choices = allocations.map(a => ({
                name: `${a.flight?.number || 'UNKNOWN'} (${a.flight?.from || '???'} ➔ ${a.flight?.to || '???'} | ${a.flight?.date || 'Today'})`,
                value: a.messageId
            }));

            await interaction.respond(choices).catch(() => {});
        } catch {
            await interaction.respond([]).catch(() => {});
        }
    },

    async execute(interaction) {
        if (typeof checkRole === 'function' && !(await checkRole(interaction))) return;
        
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const messageId = interaction.options.getString('message_id');
        const customMsg = interaction.options.getString('message') || null;

        let allocation;

        if (messageId) {
            // Find by specific message ID if provided
            allocation = await Allocation.findOne({ messageId });
        } else {
            // Auto-fallback: Find the latest allocation sheet posted in this channel
            allocation = await Allocation.findOne({ channelId: interaction.channelId })
                .sort({ createdAt: -1 });
        }

        if (!allocation) {
            return interaction.editReply('❌ Flight allocation not found. Ensure a flight sheet exists in this channel or select a valid flight.');
        }

        const flight = allocation.flight || {};

        // Comprehensive LOT role key list (both short keys and schema property aliases)
        const roleKeys = [
            'dc', 'dispatchCoordinator', 'departureCoordinator',
            'mb', 'dispatchSupervisor', 'flightSupervisor', 'managementBoard',
            'cpt', 'captain',
            'fo', 'firstOfficer',
            'stbyFd', 'standbyFlightDeck',
            'purser',
            'cc', 'cabinCrew',
            'stbyCc', 'standbyCabinCrew',
            'ts', 'tarmacSupervisor',
            'gc', 'groundCrew', 'groundHandling',
            'stbyGc', 'standbyGroundCrew',
            'bcbd', 'bagDropAgent', 'businessClassBagDrop',
            'ecbd', 'economyBagDrop', 'economyClassBagDrop',
            'cs', 'customerService',
            'gate', 'gateAgent'
        ];

        const allUserIds = new Set();

        // 1. Extract directly assigned users across all role keys
        for (const key of roleKeys) {
            const val = allocation[key];
            if (Array.isArray(val)) {
                val.forEach(id => { if (id) allUserIds.add(id); });
            } else if (typeof val === 'string' && val.trim().length > 0) {
                allUserIds.add(val.trim());
            }
        }

        // 2. Extract queued users if a queue structure exists
        if (allocation.queues && typeof allocation.queues === 'object') {
            for (const qKey of Object.keys(allocation.queues)) {
                if (Array.isArray(allocation.queues[qKey])) {
                    allocation.queues[qKey].forEach(id => { if (id) allUserIds.add(id); });
                }
            }
        }

        if (allUserIds.size === 0) {
            return interaction.editReply('❌ No staff are currently allocated to this flight.');
        }

        const flightNum = flight.number || 'LO 000';
        const routeStr  = flight.route || `${flight.from || 'WARSAW'} ➔ ${flight.to || 'DESTINATION'}`;
        const aircraft  = flight.aircraft || flight.plane || 'Boeing 737 MAX 8';
        const staffTime = flight.staff_time || flight.staffTime || 'TBD';
        const paxTime   = flight.passenger_time || flight.passengerTime || 'TBD';
        const gate      = flight.gate || 'TBD';

        const embed = new EmbedBuilder()
            .setColor(LOT_NAVY)
            .setAuthor({ 
                name: 'LOT Polish Airlines — Flight Operations', 
                iconURL: interaction.guild?.iconURL({ dynamic: true }) || undefined 
            })
            .setTitle(`${EMOJIS.TAIL} Duty Reminder — Flight ${flightNum}`)
            .setDescription(`You have been sent an official duty reminder regarding your allocated shift for an upcoming LOT Polish Airlines flight.`)
            .addFields(
                { name: 'Flight', value: `**${flightNum}**`, inline: true },
                { name: 'Route', value: routeStr, inline: true },
                { name: 'Aircraft', value: aircraft, inline: true },
                { name: 'Personnel Join Time', value: staffTime, inline: true },
                { name: 'Passenger Joining Time', value: paxTime, inline: true },
                { name: 'Gate', value: gate, inline: true }
            )
            .setFooter({ text: 'LOT Polish Airlines • Flight Operations' })
            .setTimestamp();

        if (customMsg) {
            embed.addFields({ name: '📢 Message from Flight Operations', value: customMsg, inline: false });
        }

        let sent = 0;
        let failed = 0;

        for (const userId of allUserIds) {
            try {
                const user = await interaction.client.users.fetch(userId);
                if (user) {
                    await user.send({ embeds: [embed] });
                    sent++;
                }
            } catch {
                failed++;
            }
        }

        // Audit Log entry
        const logChannelId = process.env.LOG_CHANNEL_ID;
        if (logChannelId) {
            try {
                const logChannel = await interaction.client.channels.fetch(logChannelId);
                await logChannel.send(`📢 Duty Reminder Sent | **Flight ${flightNum}** | Executed by: <@${interaction.user.id}> | Successfully DM'd: ${sent} | Failed: ${failed}`);
            } catch {}
        }

        await interaction.editReply(`✅ Reminder successfully sent to **${sent}** staff member(s)${failed > 0 ? ` (${failed} failed — DMs may be closed)` : ''}.`);
    },
};
