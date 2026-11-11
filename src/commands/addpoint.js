const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const Allocation = require('../models/Allocation');
const Profile = require('../models/Profile');
const { checkRole } = require('../utils/checkRole');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addpoint')
        .setDescription('Award flight points to staff from a selected flight allocation sheet')
        .addStringOption(o =>
            o.setName('flight_id')
                .setDescription('Select the flight from the database')
                .setAutocomplete(true)
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName('points')
                .setDescription('Amount of points to add (Default: 1)')
                .setRequired(false)
        )
        .addUserOption(o =>
            o.setName('user')
                .setDescription('Optional: Award points to a specific allocated user only')
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

        const messageId = interaction.options.getString('flight_id');
        const pointsToAdd = interaction.options.getInteger('points') || 1;
        const targetUser = interaction.options.getUser('user');

        const allocation = await Allocation.findOne({ messageId });
        if (!allocation) {
            return interaction.editReply('❌ Selected flight allocation sheet was not found in the database.');
        }

        const roleKeys = [
            'dc', 'mb', 'cpt', 'fo', 'stbyFd', 'purser', 'cc', 'stbyCc',
            'ts', 'gc', 'stbyGc', 'bcbd', 'ecbd', 'cs', 'gate',
            'dispatchCoordinator', 'managementBoard', 'captain', 'firstOfficer',
            'standbyFlightDeck', 'cabinCrew', 'standbyCabinCrew', 'tarmacSupervisor',
            'groundCrew', 'standbyGroundCrew', 'bagDropAgent', 'economyBagDrop',
            'customerService', 'gateAgent'
        ];

        const targetUserIds = new Set();

        if (targetUser) {
            targetUserIds.add(targetUser.id);
        } else {
            // Extract all allocated staff from the flight sheet
            for (const key of roleKeys) {
                const val = allocation[key];
                if (Array.isArray(val)) {
                    val.forEach(id => { if (id) targetUserIds.add(id); });
                } else if (typeof val === 'string' && val.trim().length > 0) {
                    targetUserIds.add(val.trim());
                }
            }
        }

        if (targetUserIds.size === 0) {
            return interaction.editReply('❌ No allocated staff were found on this flight sheet to award points to.');
        }

        let updatedCount = 0;
        let missingProfiles = 0;

        for (const userId of targetUserIds) {
            const profile = await Profile.findOne({ userId });
            if (profile) {
                profile.flightPoints += pointsToAdd;
                await profile.save();
                updatedCount++;
            } else {
                missingProfiles++;
            }
        }

        await interaction.editReply(
            `✅ Successfully added **${pointsToAdd}** flight point(s) to **${updatedCount}** staff member(s) for flight **${allocation.flight?.number || 'Flight'}**.` +
            (missingProfiles > 0 ? `\n⚠️ **${missingProfiles}** staff member(s) were skipped because they do not have a registered profile.` : '')
        );
    }
};
