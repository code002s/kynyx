const axios = require('axios');

async function resolveTarget(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) throw new Error('Empty target');

  if (/^\d+$/.test(trimmed)) {
    try {
      const { data } = await axios.get(`https://users.roblox.com/v1/users/${trimmed}`, { timeout: 5000 });
      return { userId: String(data.id), username: data.name, displayName: data.displayName };
    } catch {
      return { userId: trimmed, username: `User_${trimmed}`, displayName: `User_${trimmed}` };
    }
  }

  const { data } = await axios.post(
    'https://users.roblox.com/v1/usernames/users',
    { usernames: [trimmed], excludeBannedUsers: false },
    { timeout: 5000 }
  );
  const u = (data?.data || [])[0];
  if (!u) throw new Error(`User "${trimmed}" not found`);
  return { userId: String(u.id), username: u.name, displayName: u.displayName };
}

module.exports = { resolveTarget };
