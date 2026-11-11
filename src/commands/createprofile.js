const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const Profile = require('../models/Profile');
const { checkRole } = require('../utils/checkRole');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('createprofile')
        .setDescription('Create or update a Roblox profile for a staff member')
        .addUserOption(o => 
            o.setName('user')
                .setDescription('Discord user')
                .setRequired(true)
        )
        .addStringOption(o => 
            o.setName('username')
                .setDescription('Roblox Username')
                .setRequired(true)
        )
        .addStringOption(o => 
            o.setName('robloxid')
                .setDescription('Roblox User ID')
                .setRequired(true)
        )
        .addStringOption(o => 
            o.setName('rank')
                .setDescription('Staff Rank (Default: Flight Crew)')
                .setRequired(false)
        ),

    async execute(interaction) {
        if (typeof checkRole === 'function' && !(await checkRole(interaction))) return;

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const user = interaction.options.getUser('user');
        const robloxUsername = interaction.options.getString('username');
        const robloxId = interaction.options.getString('robloxid');
        const rank = interaction.options.getString('rank') || 'Flight Crew';

        let profile = await Profile.findOne({ userId: user.id });

        if (profile) {
            profile.robloxUsername = robloxUsername;
            profile.robloxId = robloxId;
            profile.rank = rank;
            await profile.save();
            return interaction.editReply(`✅ Updated profile for <@${user.id}> (**${robloxUsername}**).`);
        } else {
            profile = new Profile({
                userId: user.id,
                robloxUsername,
                robloxId,
                rank
            });
            await profile.save();
            return interaction.editReply(`✅ Created new profile for <@${user.id}> (**${robloxUsername}**).`);
        }
    }
};
