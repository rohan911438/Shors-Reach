# Telegram bot — BotFather setup

Avatar: `telegram-bot-avatar.png` (640×640; Telegram crops it to a circle, the mark stays inside the safe area).

| BotFather command | Value |
|---|---|
| `/newbot` → name | `Shor's Reach Alerts` |
| `/newbot` → username | `ShorsReachBot` (fallbacks: `ShorsReachAlertsBot`, `shors_reach_bot`) |
| `/setabouttext` (≤120) | `Alerts when a watched crypto address's public key becomes visible to a future quantum computer.` |
| `/setuserpic` | upload `telegram-bot-avatar.png` |
| `/setcommands` | see below |

`/setdescription` (≤512, shown before the user presses Start):

```
Shor's Reach watches the Bitcoin, EVM and QoreChain addresses you choose and messages you when their quantum exposure changes: a spend reveals a key, new funds land on an exposed key, your exposure score rises, or funds move to safety.

Turn alerts on from the Watchlist at shors-reach.vercel.app/#/watch. This bot only works with links from there.

We never ask for seed phrases or private keys. /stop deletes all your alerts and data.
```

`/setcommands`:

```
start - Link an alert from your Shor's Reach watchlist
stop - Unsubscribe and delete all your alert data
```

Leave `/setjoingroups` disabled and `/setprivacy` enabled (the bot is for private chats only).
