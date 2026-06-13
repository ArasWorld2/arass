<<<<<<< HEAD

=======
# ✈️ Flight Allocation Bot

A Discord bot for managing flight crew allocation sheets with role sign-ups, queues, and live embed updates — inspired by Thai Operations style.

---

## Features

- Post flight briefings with `/postflight`
- Interactive allocation sheet with role buttons
- Auto-queuing when roles are full
- Click again to leave a role or queue
- Queue promotion when someone leaves
- Persistent storage with MongoDB

---

## Setup Guide

### 1. Create a Discord Application

1. Go to https://discord.com/developers/applications
2. Click **New Application** → give it a name
3. Go to **Bot** tab → click **Add Bot**
4. Under **Privileged Gateway Intents**, enable:
   - ✅ Server Members Intent
   - ✅ Message Content Intent
5. Copy your **Bot Token** (you'll need this)
6. Go to **OAuth2 → General** → copy your **Client ID**

### 2. Invite the Bot to Your Server

Build this URL and open it in your browser (replace `YOUR_CLIENT_ID`):

```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=274878286912&scope=bot+applications.commands
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

```bash
cd flight-bot
```

Edit `.env` and fill in:

```
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
GUILD_ID=your_server_id        # Right-click your server → Copy Server ID
MONGODB_URI=mongodb://localhost:27017/flightbot
```

> **Don't have MongoDB?** Install it from https://www.mongodb.com/try/download/community  
> Or use MongoDB Atlas (free cloud): https://www.mongodb.com/atlas

### 5. Register Slash Commands

```bash
npm run register
```

### 6. Start the Bot

```bash
npm start
```

---

## Usage

### `/postflight`
Posts a flight briefing + allocation sheet in the current channel.

| Option | Description | Example |
|--------|-------------|---------|
| `number` | Flight number | `TG216` |
| `from` | Departure airport | `HKT` |
| `to` | Arrival airport | `BKK` |
| `staff_time` | Staff joining time | `Saturday, 9 May 2026 12:15` |
| `passenger_time` | Passenger joining time | `Saturday, 9 May 2026 12:30` |
| `aircraft` | Aircraft type | `A350-900` |

### `/removeflight`
Removes a flight allocation (requires Manage Messages permission).

| Option | Description |
|--------|-------------|
| `message_id` | The Discord message ID of the allocation post |

---

## How Buttons Work

- 🎯 Dispatch Coordinator (max 1)
- 🎯 Dispatch Supervisor (max 2)
- 🛫 Captain (max 1)
- ✈️ First Officer (max 1)
- 👤 Cabin Crew (max 6)
- ⚠️ Ground Handling (max 4)
- 🎫 Purser (max 1)
- 🔵 Tarmac Supervisor (max 1)

**Click once** → join the role  
**Click again** → leave the role  
**When full** → you're added to the queue  
**Someone leaves** → first in queue is automatically promoted

---

## Project Structure

```
flight-bot/
├── src/
│   ├── index.js              # Entry point
│   ├── commands/
│   │   ├── postflight.js     # /postflight command
│   │   └── removeflight.js   # /removeflight command
│   ├── events/
│   │   ├── ready.js          # Bot ready event
│   │   └── interactionCreate.js  # Handles all interactions
│   ├── models/
│   │   └── Allocation.js     # MongoDB schema
│   └── utils/
│       └── embeds.js         # Embed & button builders
└── scripts/
    └── register-commands.js  # One-time command registration
```

---

## Customizing Roles

Edit `src/utils/embeds.js` — find the `ROLES` array:

```js
const ROLES = [
  { key: 'captain', label: 'Captain', emoji: '🛫', max: 1 },
  // Add or remove roles here
];
```

Then update the MongoDB model (`src/models/Allocation.js`) to add the new field.

---

## License

MIT
>>>>>>> master
