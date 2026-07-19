const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const Loa = require('../models/Loa');
const { checkRole } = require('../utils/checkRole');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loa-remove')
        .setDescription('Admin: Terminate an active or approved Leave of Absence for a user')
        .addUserOption(option => 
            option.setName('target_user')
                .setDescription('The user whose LOA needs to be removed')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        // Run your existing management check logic
        if (!await checkRole(interaction)) return;
        
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        try {
            const targetUser = interaction.options.getUser('target_user');
            const guildId = process.env.GUILD_ID;
            const loaRoleId = process.env.LOA_ROLE_ID;

            // Find any approved/active LOA documents for this user
            const activeLoas = await Loa.find({ 
                userId: targetUser.id, 
                status: 'APPROVED' 
            });

            if (!activeLoas || activeLoas.length === 0) {
                return await interaction.editReply(`❌ No active or approved LOA record was found for <@${targetUser.id}>.`);
            }

            // Mark all their approved records as expired/removed so background runner ignores them
            for (const loa of activeLoas) {
                loa.status = 'EXPIRED';
                loa.roleRemoved = true;
                await loa.save();
            }

            // Strip the LOA role from the guild member if they have it
            const guild = await interaction.client.guilds.fetch(guildId).catch(() => null);
            let roleStripped = false;
            
            if (guild) {
                const member = await guild.members.fetch(targetUser.id).catch(() => null);
                if (member && member.roles.cache.has(loaRoleId)) {
                    await member.roles.remove(loaRoleId).catch(err => console.error(`Failed to strip LOA role: ${err.message}`));
                    roleStripped = true;
                }
            }

            const removalEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('🛑 Leave of Absence Forcefully Removed')
                .setDescription(`The Leave of Absence status for <@${targetUser.id}> has been terminated.`)
                .addFields(
                    { name: 'Target User', value: `<@${targetUser.id}> (\`${targetUser.id}\`)`, inline: true },
                    { name: 'Removed By', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Role Stripped', value: roleStripped ? '✅ Yes' : 'ℹ️ User did not have role active yet', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Wizz Air Operations • Timetable Security' });

            await interaction.editReply({ embeds: [removalEmbed] });

            // Send notification DM to the target user
            await targetUser.send(`🛑 **Your Leave of Absence has been terminated early by administration.** Your active status roles have been restored/updated accordingly.`).catch(() => {});

            // Forward event notification straight to your logs
            await sendLog(interaction, {
                admin: interaction.user,
                target: targetUser,
                roleStripped
            });

        } catch (error) {
            console.error('❌ Error executing /loa-remove:', error);
            await interaction.editReply(`❌ Failed to remove user's LOA state: \`${error.message}\``);
        }
    },
};

async function sendLog(interaction, { admin, target, roleStripped }) {
    const logChannelId = process.env.LOG_CHANNEL_ID;
    if (!logChannelId) return;
    try {
        const channel = await interaction.client.channels.fetch(logChannelId);
        await channel.send(`🛑 **LOA Terminated** | Target: <@${target.id}> | Admin: <@${admin.id}> | Role Stripped: **${roleStripped ? 'Yes' : 'No'}**`);
    } catch (err) {
        console.warn('Could not send loa-remove command log:', err.message);
    }
}