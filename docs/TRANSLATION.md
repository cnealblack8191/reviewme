# Translation in ReviewMe

Two layers, kept separate on purpose.

## 1. Fixed text: written twice, no service involved

Every screen label, every form question, every rating item exists in English
and Spanish in the code and the database. Workers pick their language on the
link screens. Reviewers pick theirs with the EN / ES toggle on the phone home;
it is stored on their account. The office desktop is English.

## 2. Typed text: machine translated, original always kept

What people type is translated with **Azure AI Translator** so a Spanish
speaking worker and an English speaking foreman can read each other:

| Who typed it | Who reads it translated |
|---|---|
| Worker's self-evaluation answers and comments | Foreman on the phone form, office on the review page and in the office PDF |
| Supervisor's item comments, overall comments, goals | Worker on the sign screen and in the employee PDF |

The translation is shown first, labelled *Machine translated*, with the
original underneath in smaller type. Nothing is ever replaced. A sentence is
translated once and cached in the `Translation` table, so the same text never
costs twice. If the service is off or unconfigured, everyone simply sees the
original.

## Setting it up

1. In the Azure portal create a **Translator** resource (AI services →
   Translator). Pick the **F0 free tier**: two million characters a month. A
   full ECI review period is well under a hundred thousand.
2. Open the resource → **Keys and Endpoint**. Copy Key 1 and the Region
   (for example `eastus`).
3. In ReviewMe, Settings → **Translation of typed text**: paste the key, enter
   the region, leave the endpoint blank, save, then press **Translate a test
   sentence to Spanish**.
4. Leave the **Translate typed text** switch on.

The environment variables `AZURE_TRANSLATOR_KEY`, `AZURE_TRANSLATOR_REGION`
and `AZURE_TRANSLATOR_ENDPOINT` work as a fallback when nothing is saved in
Settings.

## What is sent to Microsoft

Only the typed text being translated, over HTTPS, with a random trace id.
Azure AI Translator does not retain the text after the response with the
default no-trace configuration. No names, ratings, or pay data leave the app.
