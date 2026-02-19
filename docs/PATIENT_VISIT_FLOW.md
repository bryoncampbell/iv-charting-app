# Patient Intake & Visit Flow

This document describes the intended end-to-end flow for checking in a patient, completing nursing documentation, provider review, administration, and closing the encounter.

---

## 1. Check-in (Nurse)

- Nurse goes to **Visits** and clicks **New Visit** (or navigates to **New Visit**).
- On **New Visit**, the nurse **searches for the patient** (name, phone, or date of birth).
- **If the patient is found** in the list of established patients:
  - Nurse clicks **Start visit** for that patient.
- **If the patient is not found**:
  - Nurse clicks **Add new patient**, fills in required fields (first name, last name, DOB, phone), and submits.
  - After the new patient is created, a visit is **started automatically** for that patient.
- Starting a visit creates an encounter in status **in_progress** and opens the **Encounter** page for that visit.

---

## 2. Nursing Documentation (Nurse)

- On the encounter page, the nurse completes (in order):
  - **Intake** – Chief complaint, history of present illness, medications, past medical history.
  - **Vitals** – At least one vital reading.
  - **IV Access** – Site, gauge, date/time placed, notes.
  - **Order request** – IV fluid, volume, rate, additives/medications, order notes.
- When all required nursing sections are complete, the nurse clicks **Nursing complete** on the Order request tab.
- This sets the encounter status to **ready_for_provider**.

---

## 3. Provider Sees Waiting Visits

- On the **Visits** board, visits that are ready for provider review appear in **Current visits** with the status tag **Waiting for provider** (amber).
- The provider **clicks the visit row** to open it; providers are taken to the encounter with the **Provider** tab open (`?tab=provider`).

---

## 4. Provider Review & Approve or Decline

- On the **Provider** tab, the provider:
  - Reads the **nursing summary** (patient context, intake, vitals, IV access, requested order).
  - **Either:**
    - **Approve order** – Marks the order as approved; the patient is then **ready for infusion** and the nurse can document administration.
    - **Decline to treat** – Optionally enters a reason and declines; the visit moves to a declined state and the nurse can acknowledge and close.
- If the provider approves, the visit remains in status **ready_for_provider** but with the order approved (phase on the board can show **Orders approved** and later **Infusion in progress** / **Ready for discharge** as the nurse completes administration).

---

## 5. Administration (Nurse, After Order Approved)

- After the provider has **approved the order**, the **Administration** tab becomes available (and is required).
- The nurse documents:
  - Infusion started (date/time).
  - Infusion ended (date/time).
  - Complications.
  - How the patient tolerated (and free text if needed).
- When the infusion is complete and the patient is ready to go, the nurse clicks **Patient completed infusion — ready for discharge (pending provider review)**.
- This records **Ready for discharge** so the provider knows the patient is ready for final review and sign-off.

---

## 6. Discharge & Close Encounter (Provider)

- The provider returns to the **Provider** tab (or opens the visit from the board; it may show **Ready for discharge** or similar).
- The provider:
  - Reviews the **administration record** (start/end times, complications, tolerance).
  - Fills in **Provider note** and **Discharge instructions**.
  - Clicks **Sign to complete visit**.
- Signing sets the encounter status to **completed** and closes the visit. The visit then appears in **Visit history** on the Visits board.

---

## Summary (Status Flow)

| Step | Who | Action | Status / Board state |
|------|-----|--------|----------------------|
| 1 | Nurse | New Visit → search → Start visit (or add patient) | **in_progress** – Intake |
| 2 | Nurse | Complete Intake, Vitals, IV Access, Order request → Nursing complete | **ready_for_provider** – Waiting for provider |
| 3 | Provider | Open visit from board → Provider tab → Approve order (or Decline) | **ready_for_provider** – Orders approved |
| 4 | Nurse | Administration tab → document infusion → Ready for discharge | **ready_for_provider** – Ready for discharge |
| 5 | Provider | Provider tab → Provider note & discharge → Sign to complete visit | **completed** – Visit history |

---

## Navigation Quick Reference

- **Visits** – List of current and completed visits; **New Visit** starts check-in.
- **New Visit** – Search patients or add new patient; **Start visit** begins the encounter.
- **Encounter** – Tabs: Intake, Vitals, IV Access, Order request, Administration (after approval), Provider, Addendum. Role-based editing applies (nursing vs provider sections).
