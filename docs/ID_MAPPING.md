# RecoVibe ID and Data Mapping

This project currently uses browser `localStorage` rather than a backend API or
database. The mappings below document the current frontend contract without
renaming the existing storage fields.

## Student accounts

| Frontend field     | JavaScript property | Storage key                       | Database/API status |
| ------------------ | ------------------- | --------------------------------- | ------------------- |
| `reg-student-id`   | `studentId`         | `recovibeAccounts[].studentId`    | No backend/database |
| `reg-email`        | `email`             | `recovibeAccounts[].email`        | No backend/database |
| `reg-pass`         | `password`          | `recovibeAccounts[].password`     | No backend/database |
| `reg-contact`      | `contact`           | `recovibeAccounts[].contact`      | No backend/database |
| `reg-year`         | `year`              | `recovibeAccounts[].year`         | No backend/database |
| `reg-department`   | `department`        | `recovibeAccounts[].department`   | No backend/database |
| `reg-organization` | `organization`      | `recovibeAccounts[].organization` | No backend/database |

## Organizer events

| Frontend field                         | JavaScript property    | Storage key                                      | Database/API status |
| -------------------------------------- | ---------------------- | ------------------------------------------------ | ------------------- |
| `eventName`                            | `title`                | `recovibeOrganizerEvents[].title`                | No backend/database |
| `eventOrganizer`                       | `organizerName`        | `recovibeOrganizerEvents[].organizerName`        | No backend/database |
| `eventDate`                            | `dateISO`              | `recovibeOrganizerEvents[].dateISO`              | No backend/database |
| `timeStart` / `timeEnd`                | `time`                 | `recovibeOrganizerEvents[].time`                 | No backend/database |
| `registrationDeadline`                 | `registrationDeadline` | `recovibeOrganizerEvents[].registrationDeadline` | No backend/database |
| Location select `data-name="location"` | `location` / `room`    | `recovibeOrganizerEvents[].location`             | No backend/database |
| `locationCapacity`                     | `capacity`             | `recovibeOrganizerEvents[].capacity`             | No backend/database |

## Organizer event approval fields

The project currently has no backend/API or database implementation. Organizer
event records are stored in `recovibeOrganizerEvents`. The My Events page reads
the existing approval properties without allowing the organizer to change them:

| UI indicator | Existing event property                          | Meaning                                 |
| ------------ | ------------------------------------------------ | --------------------------------------- |
| HAP 1        | `hap1Approved`, `hap_1_status`, or legacy `hap1` | Administrator approval stage 1          |
| HAP 2        | `hap2Approved`, `hap_2_status`, or legacy `hap2` | Administrator approval stage 2          |
| HAP 3        | `hap3Approved`, `hap_3_status`, or legacy `hap3` | Administrator approval stage 3          |
| Status       | `status`                                         | Existing organizer event status         |
| Published    | `published`                                      | Existing localStorage publication flag  |
| Cancelled    | `cancelled`                                      | Existing localStorage cancellation flag |

Publishing is guarded in `EventOrganizerData.js`: the event must belong to the
current organizer, have all three HAP stages approved, have status `Approved`,
and not already be published or cancelled.
| `alternateCapacity` | Alternate venue capacity display | Not persisted | No backend/database |
| Organizer identity | `organizerId` | `recovibeOrganizerId` | Client-controlled only |

## Shared event feed

Organizer records are adapted by `organizerEventToFeed()` and merged into the
student feed as `window.RECOVIBE_EVENTS`. This is a browser-local development
adapter, not an authorization boundary or a substitute for server-side
validation.
