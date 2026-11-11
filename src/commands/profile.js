const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
const Profile = require('../models/Profile');

const EMOJIS = {
    TAIL: '<:LOTTail:1520114549490057226>',
    ARROW: '<:LOTSArrow:1520114515318935584>'
};
const LOT_NAVY = '#0C2340';
const LOT_GROUP_ID = 15347085;

async function getRobloxGroupRank(robloxId) {
    try {
        const res = await fetch(`https://groups.roblox.com/v1/users/${robloxId}/groups/roles`);
        if (!res.ok) return null;
        const data = await res.json();
        if (data && Array.isArray(data.data)) {
            const groupInfo = data.data.find(g => g.group && g.group.id === LOT_GROUP_ID);
            if (groupInfo && groupInfo.role) return groupInfo.role.name;
        }
    } catch (err) {
        console.error('Failed to fetch Roblox group rank:', err);
    }
    return null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View your LOT Polish Airlines staff profile')
        .addUserOption(o => 
            o.setName('user')
                .setDescription('Optional: Check another staff member\'s profile')
                .setRequired(false)
        ),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const profile = await Profile.findOne({ userId: targetUser.id });

        if (!profile) {
            if (targetUser.id !== interaction.user.id) {
                return interaction.reply({
                    content: `❌ <@${targetUser.id}> does not have a profile set up yet.`,
                    ephemeral: true
                });
            }

            const createBtn = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_open_profile_modal')
                    .setLabel('Create Profile')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📝')
            );

            return interaction.reply({
                content: `❌ **No Profile Found**\nYou do not have an active profile registered in the system. Click the button below to register your Roblox account details!`,
                components: [createBtn],
                ephemeral: true
            });
        }

        // Check if profile is pending HR approval
        if (profile.isApproved === false) {
            return interaction.reply({
                content: `⏳ **Pending Approval:** ${targetUser.id === interaction.user.id ? 'Your profile registration has been sent to Human Resources and is currently awaiting approval.' : `<@${targetUser.id}>\'s profile registration is currently pending HR approval.`}`,
                ephemeral: true
            });
        }

        await interaction.deferReply();

        // Fetch Live Roblox Headshot Avatar Thumbnail
        const avatarUrl = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${profile.robloxId}&size=420x420&format=Png&isCircular=false`;
        let headshotImage = 'https://i.imgur.com/vH3sY5r.png';

        try {
            const res = await fetch(avatarUrl);
            const data = await res.json();
            if (data?.data?.[0]?.imageUrl) {
                headshotImage = data.data[0].imageUrl;
            }
        } catch (err) {
            console.error('Failed to fetch Roblox avatar:', err);
        }

        // Fetch Live Group Rank
        const liveRank = await getRobloxGroupRank(profile.robloxId);
        const displayRank = liveRank || profile.rank || 'Guest / Unranked';

        // Calculate Salary (1 Point = 25 RBX)
        const totalPoints = (profile.flightPoints || 0) + (profile.hostPoints || 0);
        const calculatedSalary = totalPoints * 25;

        const description = 
            `Designated for **${profile.robloxUsername}**\n\n` +
            `✈️ **Flight Points:**\n│ ${profile.flightPoints || 0}\n\n` +
            `🎫 **Host Points:**\n│ ${profile.hostPoints || 0}\n\n` +
            `⚠️ **Warnings:**\n│ ${profile.warnings || 0}\n\n` +
            `💵 **Salary:**\n│ ${calculatedSalary} R$\n\n` +
            `👤 **Rank:**\n│ ${displayRank}`;

        const embed = new EmbedBuilder()
            .setColor(LOT_NAVY)
            .setAuthor({ 
                name: 'LOT Polish Airlines — Flight Operations', 
                iconURL: interaction.guild?.iconURL({ dynamic: true }) || undefined 
            })
            .setTitle(`${EMOJIS.TAIL} Employee Profile`)
            .setDescription(description)
            .setThumbnail(headshotImage)
            .setFooter({ text: `LOT Polish Airlines • Staff ID: ${profile.robloxId}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
