const Loa = require('../models/Loa');

async function checkLoaSchedules(client) {
    const guildId = process.env.GUILD_ID;
    const loaRoleId = process.env.LOA_ROLE_ID; // The role they get when on LOA (e.g. [LOA])
    
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;

    const now = new Date();

    try {
        // 1. Give Roles: Fetch approved LOAs that have started but haven't received the role yet
        const pendingStarts = await Loa.find({ status: 'APPROVED', startDate: { $lte: now }, roleApplied: false });
        
        for (const loa of pendingStarts) {
            const member = await guild.members.fetch(loa.userId).catch(() => null);
            if (member) {
                await member.roles.add(loaRoleId).catch(err => console.error(`Failed to apply LOA role: ${err.message}`));
            }
            loa.roleApplied = true;
            await loa.save();
            console.log(`[LOA Engine] Role added to user ${loa.userId}`);
        }

        // 2. Take Roles Away: Fetch approved LOAs where the deadline has passed
        const pendingEnds = await Loa.find({ status: 'APPROVED', endDate: { $lte: now }, roleRemoved: false });

        for (const loa of pendingEnds) {
            const member = await guild.members.fetch(loa.userId).catch(() => null);
            if (member) {
                await member.roles.remove(loaRoleId).catch(err => console.error(`Failed to clear LOA role: ${err.message}`));
            }
            loa.roleRemoved = true;
            loa.status = 'EXPIRED';
            await loa.save();
            console.log(`[LOA Engine] Role removed from expired user ${loa.userId}`);
        }

    } catch (error) {
        console.error('❌ Error executing automated LOA cycle check:', error.message);
    }
}

module.exports = { checkLoaSchedules }; 