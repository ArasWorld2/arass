const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Profile = require('../models/Profile');

// Custom LOT Emojis & Branding
const EMOJIS = {
    TAIL: '<:LOTTail:1520114549490057226>',
    ARROW: '<:LOTSArrow:1520114515318935584>',
    DOT: '<:Dot:1243911986115248138>'
};
const LOT_NAVY = '#0C2340';
const LOT_GROUP_ID = 15347085;

// Helper to fetch live Roblox Group rank
async function getRobloxGroupRank(robloxId) {
    try {
        const res = await fetch(`https://groups.roblox.com/v1/users/${robloxId}/groups/roles`);
        if (!res.ok) return null;
        const data = await res.json();
        if (data && Array.isArray(data.data)) {
            const groupInfo = data.data.find(g => g.group && g.group.id === LOT_GROUP_ID);
            if (groupInfo && groupInfo.role) {
                return groupInfo.role.name;
            }
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
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const profile = await Profile.findOne({ userId: targetUser.id });

        if (!profile) {
            return interaction.editReply({
                content: `❌ **No Profile Found**\n${targetUser.id === interaction.user.id ? 'You do not have an active profile registered in the system. Please inform Administration so they can set one up for you.' : `<@${targetUser.id}> does not have a profile set up yet.`}`
            });
        }

        // Fetch Live Roblox Headshot Avatar Thumbnail
        const avatarUrl = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${profile.robloxId}&size=420x420&format=Png&isCircular=false`;
        let headshotImage = 'https://i.imgur.com/vH3sY5r.png'; // Fallback LOT Logo

        try {
            const res = await fetch(avatarUrl);
            const data = await res.json();
            if (data && data.data && data.data[0] && data.data[0].imageUrl) {
                headshotImage = data.data[0].imageUrl;
            }
        } catch (err) {
            console.error('Failed to fetch Roblox avatar:', err);
        }

        // Fetch Live Group Rank from Roblox API (Fallback to saved DB rank if not found)
        const liveRank = await getRobloxGroupRank(profile.robloxId);
        const displayRank = liveRank || profile.rank || 'Guest / Unranked';

        // Calculate Salary: 1 Point = 25 RBX
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
