const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const Profile = require('../models/Profile');

// Custom LOT Emojis & Branding
const EMOJIS = {
    TAIL: '<:LOTTail:1520114549490057226>',
    ARROW: '<:LOTSArrow:1520114515318935584>',
    DOT: '<:Dot:1243911986115248138>'
};
const LOT_NAVY = '#0C2340';

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

        // Fetch Roblox Headshot Avatar Thumbnail
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

        const description = 
            `Designated for **${profile.robloxUsername}**\n\n` +
            `✈️ **Flight Points:**\n│ ${profile.flightPoints}\n\n` +
            `🎫 **Host Points:**\n│ ${profile.hostPoints}\n\n` +
            `⚠️ **Warnings:**\n│ ${profile.warnings}\n\n` +
            `💵 **Salary:**\n│ ${profile.salary}\n\n` +
            `👤 **Rank:**\n│ ${profile.rank}`;

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
