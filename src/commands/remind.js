const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const Allocation = require('../models/Allocation');
const { checkRole } = require('../utils/checkRole');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remind')
        .setDescription('Send a DM reminder to all allocated staff on a flight')
        .addStringOption(o => 
            o.setName('message_id')
                .setDescription('Optional: Message ID of the flight sheet (defaults to latest in channel)')
                .setRequired(false)
        )
        .addStringOption(o => 
            o.setName('message')
                .setDescription('Custom message to include (optional)')
                .setRequired(false)
        ),

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
            return interaction.editReply('❌ Flight allocation not found. Ensure a flight sheet exists in this channel or provide a valid Message ID.');
        }

        const flight = allocation.flight || {};

        // Safely extract ALL potential role array keys used across the bot
        const roleKeys = [
            'flightDispatcher', 'dispatchSupervisor', 'flightSupervisor', 'captain', 
            'firstOfficer', 'seniorCabinAttendant', 'purser', 'cabinCrew', 
            'turnaroundManager', 'groundCrew', 'groundHandling', 'tarmacSupervisor', 
            'dispatchCoordinator', 'customerService', 'bagDropAgent', 'gateAgent', 'loungeAttendant'
        ];

        const allUserIds = new Set();

        for (const key of roleKeys) {
            if (Array.isArray(allocation[key])) {
                allocation[key].forEach(id => {
                    if (id) allUserIds.add(id);
                });
            }
        }

        if (allUserIds.size === 0) {
            return interaction.editReply('❌ No staff are currently allocated to this flight.');
        }

        const embed = new EmbedBuilder()
            .setColor(0xD3007F)
            .setAuthor({ name: 'Wizz Air — Flight Operations', iconURL: 'https://download.logo.wine/logo/Wizz_Air/Wizz_Air-Logo.wine.png' })
            .setTitle(`✈️ Duty Reminder — Flight ${flight.number || 'W45139'}`)
            .setDescription(`You have been sent a reminder regarding your allocated duty on an upcoming flight shift.`)
            .addFields(
                { name: 'Flight', value: `**${flight.number || 'TBA'}**`, inline: true },
                { name: 'Route', value: `${flight.route || `${flight.from || 'TBA'} → ${flight.to || 'TBA'}`}`, inline: true },
                { name: 'Aircraft', value: flight.aircraft || flight.plane || 'A321 NEO', inline: true },
                { name: 'Personnel Join Time', value: flight.staffTime || flight.personnelJoinTime || 'TBA', inline: true },
                { name: 'Passenger Joining Time', value: flight.passengerTime || flight.passengerJoinTime || 'TBA', inline: true },
                { name: 'Gate', value: flight.gate || 'TBA', inline: true }
            )
            .setFooter({ text: 'Wizz Air Virtual Operations • Fly Greenest' })
            .setTimestamp();

        if (customMsg) {
            embed.addFields({ name: '📢 Message from Operations', value: customMsg, inline: false });
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

        // Log to log channel
        const logChannelId = process.env.LOG_CHANNEL_ID;
        if (logChannelId) {
            try {
                const logChannel = await interaction.client.channels.fetch(logChannelId);
                await logChannel.send(`📢 Reminder sent | **Flight ${flight.number || 'Unknown'}** | By: <@${interaction.user.id}> | Sent: ${sent} | Failed: ${failed}`);
            } catch {}
        }

        await interaction.editReply(`✅ Reminder successfully sent to **${sent}** staff member(s)${failed > 0 ? ` (${failed} failed — DMs may be closed)` : ''}.`);
    },
};