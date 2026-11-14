const { ApplicationCommandType, ContextMenuCommandBuilder, MessageFlags } = require('bisim.js');

module.exports = {
  data: new ContextMenuCommandBuilder().setName('User Info').setType(ApplicationCommandType.User),
  async execute(interaction) {
    const user = interaction.targetUser;
    const member = interaction.targetMember;
    const lines = [`**${user.displayName}** (@${user.username}, ${user.id})`];
    if (member?.joinedAt) lines.push(`Joined ${member.joinedAt.toDateString()}`);
    await interaction.reply({ content: lines.join('\n'), flags: MessageFlags.Ephemeral });
  },
};
