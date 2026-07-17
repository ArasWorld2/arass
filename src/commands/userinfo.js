const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Display a comprehensive intelligence report for a user')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user to fetch information for')
                .setRequired(false)
        ),

    async execute(interaction) {
        // 1. Instantly acknowledge the interaction to prevent expiration timeouts
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        try {
            // Default to the user running the command if no target is specified
            const user = interaction.options.getUser('target') || interaction.user;
            let member;
            
            try {
                member = await interaction.guild.members.fetch(user.id);
            } catch (err) {
                return await interaction.editReply('❌ Could not fetch server member data for this user.');
            }

            // Calculate timestamps and dates
            const createdTimestamp = Math.floor(user.createdTimestamp / 1000);
            const joinedTimestamp = Math.floor(member.joinedTimestamp / 1000);

            // Calculate Join Position safely
            let joinPosition = 'N/A';
            try {
                const allMembers = await interaction.guild.members.fetch({ withPresences: false });
                const sortedMembers = [...allMembers.values()].sort((a, b) => (a.joinedTimestamp || 0) - (b.joinedTimestamp || 0));
                joinPosition = sortedMembers.findIndex(m => m.id === user.id) + 1;
            } catch (cacheErr) {
                console.warn('[UserInfo Warning] Could not calculate join placement order:', cacheErr.message);
            }

            // Extract and format roles
            const roles = member.roles.cache
                .filter(role => role.id !== interaction.guild.id) // Filter out @everyone
                .map(role => role.toString());
            const displayRoles = roles.length > 0 ? roles.join(' ') : 'None';
            const topRole = member.roles.highest ? member.roles.highest.toString() : 'None';

            // Check if user is boosting the server
            const boostingSince = member.premiumSince 
                ? `<t:${Math.floor(member.premiumSince.getTime() / 1000)}:R>` 
                : 'No';

            // Setup the info embed card matching Wizz theme
            const infoEmbed = new EmbedBuilder()
                .setColor('#d3007f')
                .setAuthor({ 
                    name: `👤 ${user.username}`, 
                    iconURL: user.displayAvatarURL({ dynamic: true }) 
                })
                .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setDescription(
                    `➔ This section provides a comprehensive overview of **${user.username}**'s Discord profile, including account details, server presence, roles, permissions, and status.`
                )
                .addFields(
                    {
                        name: 'General Information',
                        value: `• **Display Name:** ${member.displayName}\n• **Username:** ${user.username}\n• **ID:** \`${user.id}\`\n• **Bot:** ${user.bot ? 'Yes' : 'No'}\n• **Acknowledgement:** ${member.id === interaction.guild.ownerId ? 'Server Owner' : 'Member'}`,
                        inline: false
                    },
                    {
                        name: 'Account Dates',
                        value: `• **Created:** <t:${createdTimestamp}:D> (<t:${createdTimestamp}:R>)\n• **Joined:** <t:${joinedTimestamp}:D> (<t:${joinedTimestamp}:R>)\n• **Join Position:** **#${joinPosition}** / ${interaction.guild.memberCount}`,
                        inline: false
                    },
                    {
                        name: 'Server Details',
                        value: `• **Nickname:** ${member.nickname || 'None'}\n• **Top Role:** ${topRole}\n• **Boosting:** ${boostingSince}\n• **Timed Out:** ${member.communicationDisabledUntil ? 'Yes' : 'No'}`,
                        inline: false
                    },
                    {
                        name: `Roles [${roles.length}]`,
                        value: displayRoles,
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `Wizz Air Core • User Lookup • Requested by ${interaction.user.username}`,
                    iconURL: interaction.guild.iconURL({ dynamic: true }) || undefined
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [infoEmbed] });

        } catch (error) {
            console.error('❌ Crash detected inside /userinfo execution block:', error);
            await interaction.editReply(`❌ An internal error occurred while generating the report: \`${error.message}\``).catch(() => {});
        }
    },
};