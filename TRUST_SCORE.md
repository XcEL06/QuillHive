# Trust Score and Creator Level

QuillHive has one canonical trust measure: **Trust Score (UTI)**, a 0-100 score derived from four earned components. **Creator Level** is the human-facing label derived from that score.

## Components

- **CVS, Content Value Score (35%)**: post saves, discussion depth, and meaningful engagement.
- **BCS, Behavior Consistency Score (25%)**: posting behavior and duplicate/frequency penalties. A user with no posts starts at 0; posting without spam can earn this score.
- **CTS, Community Trust Score (20%)**: appreciation reciprocity, content diversity, and community contribution.
- **CIS, Content Impact Score (20%)**: average post-level engagement depth, longevity, spread, and discussion.

The formula is `UTI = CVS * 0.35 + BCS * 0.25 + CTS * 0.20 + average(CIS) * 0.20`, clamped to 0-100.

Platform trust exception: super-admin and official accounts are classified as Luminary with a 100 UTI for trust display and distribution eligibility. Their CVS, BCS, CTS, and CIS values remain based only on recorded activity; this exception does not create views or other engagement events.

There are no neutral defaults. A new account with no posts or activity has CVS, BCS, CTS, CIS, and UTI of 0 and starts as `new_voice`. Missing data is not treated as average performance.

## Creator Levels

| Trust Score | Creator Level |
| --- | --- |
| 0-29 | New Voice |
| 30-54 | Rising Creator |
| 55-69 | Established Creator |
| 70-84 | Featured Creator |
| 85-100 | Luminary |

The legacy database `tier` field remains for compatibility with older feed clients, but new UI and API consumers should use `creatorLevel` and the component breakdown. The dashboard and admin trust panel show the UTI, level, and all four components so users can understand what changed.