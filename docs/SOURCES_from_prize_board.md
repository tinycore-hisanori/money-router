# Sources behind the prize-hunter board (candidate sources for Money Router)

> Japanese version: [SOURCES_from_prize_board.ja.md](SOURCES_from_prize_board.ja.md)

- Created: 2026-11-11 (compiled from all 43 items on the author's prize-hunter board)
- Purpose: register these as sources for Money Router's crawler / Event Radar
- "Items" = how many items on the board came through that source

## A. Listing sites to crawl regularly (new items keep appearing)

| Source | Crawl URL | Type | Items | Board items | Notes |
|---|---|---|---|---|---|
| Devpost | https://devpost.com/hackathons (JSON: https://devpost.com/api/hackathons?status[]=open&status[]=upcoming&order_by=prize-amount&per_page=40) | International hackathons | 13 | Amazon Build Ship Shape / Build With AI: Basics / Codegeist 2026 / Codex×TwitchCon / GitLab Life After Code / Kiroween 2026 / Meta VR Start / Nebius×NVIDIA / PayPal AI / Qloo / QNX Global / UGREEN AI NAS / Shipaton | Most important. The API returns hackathons sorted by prize. Prize totals include non-cash items (credits etc.), and India-only, student-only and in-person events are mixed in, so eligibility checks are required |
| itch.io jams | https://itch.io/jams (filter to jams with prizes) | Game jams | 6 | Epic AI MegaJam / Game Gauntlet SIM Jam / Slapjam #2 / thatgamejam 02 / Overpowered Jam #1 / Zoud GameLab | Many jams ban AI, so extracting the AI rule is required. Page fetches often fail |
| Hackster.io | https://www.hackster.io/contests | Hardware / electronics contests | 3 | Autodesk AU2027 Product / Infineon Boss Battle / Nordic Sustain the System | Free-hardware application deadlines come before the main deadline |
| lablab.ai | https://lablab.ai/ai-hackathons | AI hackathons | 1 | AMD AI League Match 6 | League format; matches every week or two |
| Cerebral Valley | https://cerebralvalley.ai/events | AI hackathons | 1 | Built with Claude: Japan 2026 | Mostly in person in the US. Pick up only online / global editions. Often selective |
| RUN | https://events.run.world/ | Game jams (platform-run) | 2 | RUN October Jam / RUN platform (Editor's Choice) | Monthly Creator Jam, weekly Editor's Choice |
| Thingiverse | https://www.thingiverse.com/challenges | 3D design contests | 1 | Green&Hydro Challenge | Has wording discouraging AI use (skipped) |
| PCBWay | https://www.pcbway.com/activity/ | PCB design contests | 2 | PCBWay 9th Project Design Contest (incl. the older "PCBWay" entry) | Yearly |
| Tōryūmon (JDN) | https://compe.japandesign.ne.jp/ | Japanese contest portal | 2 | Yamanashi Media Arts Award / viviON CREATOR AWARD | First stop for Japanese contests with cash prizes. Many are student-only |
| Kōbo Guide | https://koubo.jp/ | Japanese contest portal | 1 | Deploy Now Contest | |

## B. News and round-ups (where new items are first spotted)

| Source | Crawl URL | Items | Board items | Notes |
|---|---|---|---|---|
| Dev Grants Daily | https://devgrantsdaily.com/ | 1 | Decentraland Creator Success | Round-up of grants for developers |
| Global Game Jam news | https://globalgamejam.org/news | 1 | Zoud GameLab | |
| indiegamesjp.dev | https://indiegamesjp.dev/ | 1 | SQUARE ENIX GAME CONTEST 2026 | Announcements of Japanese indie contests |
| PR TIMES | https://prtimes.jp/ (search "コンテスト 賞金") | 1 | Game Creator Kōshien 2026 | Press releases from Japanese organisers |
| Unreal Engine forums | https://forums.unrealengine.com/ | 1 | Epic AI MegaJam | First announcements of Epic-hosted events |

## C. Organisers' official pages (watched individually)

| Item | URL | Cycle |
|---|---|---|
| Tokyo esports Festa Game Development Contest | https://tokyoesportsfesta.jp/creator_contest/ | Yearly (Sep–Nov) |
| Kodansha Game Lab Monthly Awards | (Kodansha Game Lab official site) | Monthly |
| Deploy Now Contest | https://lolipop.jp/deploy-now/contest/ | Has monthly awards |
| GMO Robot Hand Contest | https://ai-robotics.gmo/lp/gmo-robot-hand-competition/ | First edition |
| Decentraland Creator Success | https://docs.decentraland.org/creator/studio-onboarding | Ongoing (weekly review) |
| CAFF Small Farm Innovation Challenge | https://caff.org/innovation-challenge/ | Yearly |
| SQUARE ENIX GAME CONTEST | https://gc2026.jp.square-enix.com/ | One-off |
| EasyEDA Spark | (EasyEDA official site) | Yearly |
| NEDO Challenge (quantum prize) | (NEDO official site) | Seasons |
| Agentic AI Hackathon with Google Cloud | (Google Cloud Japan official site) | Yearly |

## D. Sources checked that produced nothing or were excluded

- indiegamejams.com (jam timeline): mostly no prizes
- Student-only or region-only Devpost hackathons (Arbiter Hacks, Health Hackathon 3.0, etc.): excluded by eligibility
- Roblox DevForum (Developer Challenge, Inspire, Games for Change): yearly, this year's are over. Re-check in Dec–Jan

## Common filters when collecting (from how the board is run)

1. Exclude AI-banned contests (keep only AI allowed / disclose / required)
2. Check whether you can enter from Japan (excluded countries, student-only, in-person)
3. Separate what the prize is (cash or credits) from how much one person can receive
4. Store deadlines with their time zone and convert to Japan time
5. Record the result date too (the board's resultDate)
