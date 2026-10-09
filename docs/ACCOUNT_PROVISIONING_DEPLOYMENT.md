# Account Provisioning Deployment

User Management and public Student Registration create accounts directly with Firebase Authentication and Firestore transactions; neither requires Cloud Functions. Deploy `firestore.rules` for Super Admin account creation, public student registration, student-number claims, and profile writes. Student sign-in accepts the student number or email; student-number lookup still uses the optional callable for that sign-in method.

## Requirements

- Node.js 20 and npm
- Firebase project `recovibe-fad79`
- Email/password sign-in enabled in Firebase Authentication
- At least one Super Admin Firebase Auth user with a matching `adminUser/{uid}` or `users/{uid}` profile whose role is `Super Admin`
- Cloud Functions enabled on the Blaze plan only if student-number-based sign-in lookup is required; students can also sign in with email

## Deploy

Deploy the rules required by User Management from the workspace root:

```powershell
firebase deploy --config firebase.json --project recovibe-fad79 --only firestore:rules
```

To also deploy the optional callable used to look up emails for student-number-based sign-in:

```powershell
npm --prefix functions install
npm --prefix functions run check
npm --prefix functions run deploy
```

The Functions deploy script publishes callable functions and the rules. The rules file replaces the project's currently deployed Firestore rules; review the policy against any console-only rules before deployment.

## ID Behavior

Student numbers remain school-issued and manually entered. The accepted format is 15 characters: `YYYY-NNNNN-BB-D` (for example, `2025-00756-BN-1`). Staff account sequences are allocated transactionally and retained in `id_sequences`; issued IDs are kept in `account_ids` and are not released when a profile is deleted. The first allocation initializes a sequence from matching IDs on current profiles. IDs deleted before this ledger is deployed are not recoverable from this repository and should be reconciled from any available audit/export before first use.
