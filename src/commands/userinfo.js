const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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
        await interaction.deferReply({ ephemeral: false });

        try {
            const user = interaction.options.getUser('target') || interaction.user;
            
            // Fetch member data with presences forced to load
            const member = await interaction.guild.members.fetch({ user: user.id, cache: true }).catch(() => null);
            
            if (!member) {
                return await interaction.editReply('❌ This user is not currently a member of this server.');
            }

            // Timestamps
            const createdTimestamp = Math.floor(user.createdTimestamp / 1000);
            const joinedTimestamp = Math.floor(member.joinedTimestamp / 1000);

            // --- PRESENCE PROCESSING ---
            const presence = member.presence;
            const statusMap = { online: '🟢 Online', idle: '🌙 Idle', dnd: '🔴 Do Not Disturb', offline: '⚫ Offline' };
            const deviceMap = { online: '🟢 Online', idle: '🌙 Idle', dnd: '🔴 Do Not Disturb', offline: '⚫ Offline' };

            const globalStatus = presence ? (statusMap[presence.status] || '⚫ Offline') : '⚫ Offline';
            const clientDevices = presence?.clientStatus || {};
            const desktopStatus = deviceMap[clientDevices.desktop] || '⚫ Offline';
            const mobileStatus = deviceMap[clientDevices.mobile] || '⚫ Offline';
            const webStatus = deviceMap[clientDevices.web] || '⚫ Offline';

            // Activity Processing
            let activityText = 'None';
            if (presence && presence.activities.length > 0) {
                const primaryActivity = presence.activities[0];
                const typeMap = ['Playing', 'Streaming', 'Listening to', 'Watching', 'Custom Status', 'Competing in'];
                const typePrefix = typeMap[primaryActivity.type] || 'Playing';
                activityText = `**${typePrefix}** ${primaryActivity.name}${primaryActivity.state ? ` (${primaryActivity.state})` : ''}`;
            }

            // --- BADGES PROCESSING ---
            const badgeMap = {
                Staff: '🛠️ Discord Staff',
                Partner: '🤝 Partnered Server Owner',
                Hypesquad: '🎫 HypeSquad Events',
                BugHunterLevel1: '🐛 Bug Hunter Tier 1',
                HypeSquadOnlineHouse1: '🛡️ HypeSquad Bravery',
                HypeSquadOnlineHouse2: '💎 HypeSquad Brilliance',
                HypeSquadOnlineHouse3: '🧪 HypeSquad Balance',
                PremiumEarlySupporter: '🌟 Early Supporter',
                TeamPseudoUser: '👥 Team User',
                BugHunterLevel2: '👑 Bug Hunter Tier 2',
                VerifiedBot: '🤖 Verified Bot',
                VerifiedDeveloper: '👨‍💻 Early Verified Developer',
                CertifiedModerator: '🛡️ Active Developer',
            };

            const userFlags = user.flags ? user.flags.toArray() : [];
            const badges = userFlags.map(flag => badgeMap[flag]).filter(Boolean);
            const displayBadges = badges.length > 0 ? badges.join('\n• ') : 'None';

            // --- ROLES PROCESSING ---
            const roles = member.roles.cache
                .filter(role => role.id !== interaction.guild.id)
                .map(role => role.toString());
            const displayRoles = roles.length > 0 ? roles.join(' ') : 'None';
            const topRole = member.roles.highest ? member.roles.highest.toString() : 'None';

            const boostingSince = member.premiumSince 
                ? `<t:${Math.floor(member.premiumSince.getTime() / 1000)}:R>` 
                : 'No';

            // Clean Wizz Air embed layout
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
                        value: `• **Created:** <t:${createdTimestamp}:D> (<t:${createdTimestamp}:R>)\n• **Joined:** <t:${joinedTimestamp}:D> (<t:${joinedTimestamp}:R>)`,
                        inline: false
                    },
                    {
                        name: 'Presence',
                        value: `• **Status:** ${globalStatus}\n• **Mobile:** ${mobileStatus}\n• **Desktop:** ${desktopStatus}\n• **Web:** ${webStatus}\n• **Activity:** ${activityText}`,
                        inline: false
                    },
                    {
                        name: 'Server Details',
                        value: `• **Nickname:** ${member.nickname || 'None'}\n• **Top Role:** ${topRole}\n• **Boosting:** ${boostingSince}\n• **Timed Out:** ${member.communicationDisabledUntil ? 'Yes' : 'No'}`,
                        inline: false
                    },
                    {
                        name: 'Badges',
                        value: `• ${displayBadges}`,
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
            console.error('❌ Internal error in /userinfo:', error);
            await interaction.editReply(`❌ Failed to retrieve user intelligence report: \`${error.message}\``).catch(() => {});
        }
    },
};