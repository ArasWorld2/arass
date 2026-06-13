/**
 * Checks if the interaction user has the required role.
 * Set ALLOWED_ROLE_ID in your .env / Railway variables.
 * If not set, all users can use the command.
 */
async function checkRole(interaction) {
  const allowedRoleId = process.env.ALLOWED_ROLE_ID;
  if (!allowedRoleId) return true; // No restriction set

  const member = await interaction.guild.members.fetch(interaction.user.id);
  const hasRole = member.roles.cache.some(r => r.id === allowedRoleId || r.position >= interaction.guild.roles.cache.get(allowedRoleId)?.position);

  if (!hasRole) {
    await interaction.reply({
      content: '❌ You do not have the required role to use this command.',
      ephemeral: true,
    });
    return false;
  }
  return true;
}

module.exports = { checkRole };
