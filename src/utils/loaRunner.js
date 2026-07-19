const Loa = require('../models/Loa');

async function checkLoaSchedules(client) {
    const guildId = process.env.GUILD_ID;
    const loaRoleId = process.env.LOA_ROLE_ID;
    
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
        console.warn('[LOA Engine] Could not fetch guild. Check if GUILD_ID is correct.');
        return;
    }

    // Get current date flattened completely to midnight local server time
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    try {
        // ==========================================
        // 1. ASSIGN ACTIVE ROLES
        // ==========================================
        // Fetch approved LOAs that haven't had their role applied yet
        const pendingStarts = await Loa.find({ 
            status: 'APPROVED', 
            roleApplied: false 
        });
        
        for (const loa of pendingStarts) {
            // Flatten the database start date to midnight for clear calendar day matching
            const startMidnight = new Date(loa.startDate.getFullYear(), loa.startDate.getMonth(), loa.startDate.getDate());

            // If today is the start date (or past it), give the role
            if (startMidnight <= todayMidnight) {
                const member = await guild.members.fetch(loa.userId).catch(() => null);
                if (member && loaRoleId) {
                    await member.roles.add(loaRoleId).catch(err => console.error(`Failed to apply LOA role: ${err.message}`));
                }
                
                loa.roleApplied = true;
                await loa.save();
                console.log(`[LOA Engine] Role successfully applied to user ${loa.userId}`);
            }
        }

        // ==========================================
        // 2. STRIP EXPIRED ROLES
        // ==========================================
        // Fetch active LOAs that haven't had their role removed yet
        const activeLoas = await Loa.find({ 
            status: 'APPROVED', 
            roleRemoved: false 
        });

        for (const loa of activeLoas) {
            const endMidnight = new Date(loa.endDate.getFullYear(), loa.endDate.getMonth(), loa.endDate.getDate());

            // If today is strictly AFTER the end date calendar day, strip the role
            if (todayMidnight > endMidnight) {
                const member = await guild.members.fetch(loa.userId).catch(() => null);
                if (member && loaRoleId) {
                    await member.roles.remove(loaRoleId).catch(err => console.error(`Failed to clear LOA role: ${err.message}`));
                }
                
                loa.roleRemoved = true;
                loa.status = 'EXPIRED';
                await loa.save();
                console.log(`[LOA Engine] Role removed from expired user ${loa.userId}`);
            }
        }

    } catch (error) {
        console.error('❌ Error executing automated LOA cycle check:', error.message);
    }
}

module.exports = { checkLoaSchedules };