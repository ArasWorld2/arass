const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const Profile = require('../models/Profile');
const { checkRole } = require('../utils/checkRole');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deleteprofile')
        .setDescription('Delete a staff member\'s profile from the database')
        .addUserOption(o => 
            o.setName('user')
                .setDescription('The staff member whose profile you want to delete')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (typeof checkRole === 'function' && !(await checkRole(interaction))) return;

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const targetUser = interaction.options.getUser('user');
        const deletedProfile = await Profile.findOneAndDelete({ userId: targetUser.id });

        if (!deletedProfile) {
            return interaction.editReply(`❌ No active profile found in the database for <@${targetUser.id}>.`);
        }

        await interaction.editReply(`✅ Successfully deleted profile for <@${targetUser.id}> (**${deletedProfile.robloxUsername}**).`);
    }
};
