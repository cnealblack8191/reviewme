# Twilio setup and 10DLC registration for ReviewMe

US carriers require any business texting from a regular 10-digit number to
register a **brand** and a **campaign** (A2P 10DLC). Approval commonly takes
one to three weeks. Email works while this is pending.

## Order of operations

1. Create the Twilio account, verify the business, buy one local number.
2. Register the brand: legal name Electrical Contractor Inc., EIN, address,
   website, contact. Standard brand, not sole proprietor.
3. Register the campaign with the text below. Use case: **Account
   Notifications** (or Mixed if reminders are added later).
4. Attach the number to the campaign's messaging service.
5. Put `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` in `.env`
   and flip `smsEnabled` in company settings. Until then SMS is logged, not sent.

## Campaign description (paste)

> ReviewMe sends Electrical Contractor Inc. employees one-time links to
> complete and sign their own performance review. Messages go only to current
> employees whose mobile number is on file with the company. Each link is
> private to the employee and expires after 7 days. Messages are transactional:
> a link to complete a self-evaluation, a link to read and sign the approved
> review, and at most one reminder every three days while a link is open. No
> marketing content. Employees can reply STOP to opt out and START to opt back in.

## Message flow / opt-in description (paste)

> Employees give their mobile number to the ECI office in person during
> onboarding or when their review period opens, and are told they will receive
> review links by text. Numbers are entered by office staff only. Reply STOP to
> stop, HELP for help.

## Sample messages (paste, Twilio asks for 2 to 5)

1. `ECI ReviewMe: please complete your self-evaluation. Private link, just for you, valid 7 days: https://reviewme.ecinc.us/r/XXXX Reply STOP to opt out.`
2. `ECI ReviewMe: your review is ready to read and sign. Private link, valid 7 days: https://reviewme.ecinc.us/r/XXXX Reply STOP to opt out.`
3. `ECI ReviewMe: reminder, your self-evaluation link expires in 2 days: https://reviewme.ecinc.us/r/XXXX Reply STOP to opt out.`
4. `ECI ReviewMe: complete su autoevaluación. Enlace privado, válido 7 días: https://reviewme.ecinc.us/r/XXXX Responda STOP para cancelar.`

## Compliance the app enforces

- Sender identity ("ECI ReviewMe") at the start of every message.
- Opt-out language on every message. Twilio's Advanced Opt-Out handles STOP,
  START, and HELP replies automatically once enabled on the messaging service.
- Sends only between 8 a.m. and 9 p.m. in the company timezone (reminder job).
- Every send, delivery status, and error stored in `MessageLog`.
