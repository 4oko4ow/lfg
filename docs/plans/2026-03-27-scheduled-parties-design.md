# Scheduled parties

## Problem

Users arrive, find no active parties, and leave. The feed looks empty during off-peak hours, creating a negative first impression and no reason to return.

## Solution

Add a single "when" field to the existing party creation form. One unified concept, no new UI paradigms.

## Form change

Add a "когда" selector to `CreatePartyForm` with four options:

- **Сейчас** (default) - behaves exactly like today, `scheduled_at = null`
- **Через 2 часа** - `scheduled_at = now + 2h`
- **Сегодня вечером** - `scheduled_at = today at 20:00 user local time`
- **Завтра** - `scheduled_at = tomorrow at 20:00 user local time`

Default is "Сейчас" - zero disruption to existing users.

## Feed behavior

Scheduled parties appear in the feed alongside active ones. Display:

- Badge: "через 3 часа" / "завтра в 20:00"
- Join button works the same - users reserve a spot
- Party creator can still start the chat early

Sort order: active parties first, then scheduled by `scheduled_at` ascending.

## Party lifecycle

| State | Condition |
|-------|-----------|
| Scheduled | `scheduled_at` is set and in the future |
| Active | `scheduled_at` is null OR `scheduled_at` has passed |
| Closed | manually closed or auto-closed after +4h past `scheduled_at` |

## Backend changes

1. `parties` table: add `scheduled_at TIMESTAMPTZ NULL`
2. `POST /parties`: accept `scheduled_at` field
3. `GET /parties` feed query: include scheduled parties, ordered correctly
4. Auto-close job or query filter: parties where `scheduled_at + 4h < now` treated as expired

## Frontend changes

1. `CreatePartyForm.tsx`: add "когда" selector
2. `PartyCard.tsx`: show scheduled badge when `scheduled_at` is set
3. Feed sort: active first, then scheduled

## Out of scope

- Push notifications
- Reminders
- Recurring parties
- Calendar view
