# Demo walkthrough

Start the app with no `.env` values (demo mode) and tap a person on the sign-in screen. In demo mode every account's password is `maintenance1`. The same people exist if you run `supabase/seed.sql`.

| Person | Role | Sees |
|---|---|---|
| Elena Torres | Tenant, Alder Court 2A | Her unit's requests |
| Sam Patel | Tenant, Birchwood 201 **and** 202 | Both units; picks a unit when submitting |
| Jordan Kim, Hannah Lee | Tenants | Their own units |
| Priya Raman | Manager | Everything in Maple Row |
| Marcus Webb, Dana Okafor | Technicians | Only requests assigned to them |

## 1. Tenant: submit, follow, edit (Elena)

1. **New maintenance request.** Tap **Send request** with nothing filled in to see inline validation. Pick *Plumbing*, *Soon*, write a description, then send.
2. You land on the request with a success message and a history showing "Request submitted".
3. Because the request is still New and unassigned, you can **Edit request** or **Withdraw request** (the latter asks for confirmation).
4. Open the emergency sink leak already in her list: it is New and marked Emergency.

## 2. Tenant: offline draft

1. Turn off Wi-Fi (on web: DevTools → Network → Offline).
2. An amber banner appears. Open **New request**, fill it in, tap **Save draft on this device**. The banner says it is saved on this device only.
3. Go to **My requests**: the draft shows under *Drafts on this device*, labelled as not sent.
4. Reconnect. The draft shows **Send now**; send it. If sending fails, the draft stays with the error message and **Retry sending**.

## 3. Manager: triage and assign (Priya)

1. The **Queue** shows counts per status. Emergencies and urgent items sort first; completed last.
2. Search ("radiator", "Jordan", "2A"), filter by status, priority, technician or *Unassigned*. **Clear filters** resets.
3. Open Elena's sink leak. Under **Manage** choose *Marcus Webb* → **Assign technician** → confirm. The history records who did it and when. Try **Unassign** (confirmation, returns it to New).
4. Change **Priority**. Under **Status**, the only offered actions are valid transitions from the current state.
5. Open the *Waiting on Tenant* window request to see a technician's question to the tenant.
6. Open a Completed request and use **Reopen request** (confirmation; clears the completion note).

## 4. Technician: do the work (Marcus)

1. **My work** lists only what is assigned to him; the sink leak appears once Priya assigns it (sign out and back in as Marcus; demo data is shared while the app stays loaded).
2. Open it, **Start work**, post a note and add a photo, then **Mark completed**. A completion note is required and shown to the tenant. **Waiting on tenant** requires a message saying what is needed.
3. Dana Okafor sees a different list; neither can open the other's requests.

## 5. Back to the tenant

Sign in as Elena. The request shows the new status, the technician's name, the completion note in a green banner, and the full history. Hannah's window request shows an amber "We need something from you" with a reply box.

## Things to try that should fail

- As Elena, no way to reach Sam's requests; there is no route to them in the app, and the backend returns "not found".
- As a technician, no assignment or priority controls appear.
- As a tenant on a picked-up request, edit/withdraw are gone and the SQL rejects them even if the call is forged.
