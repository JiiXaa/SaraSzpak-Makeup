# Formularz kontaktowy i obsługa odpowiedzi e-mail

Ten dokument opisuje przepływ wiadomości z formularza kontaktowego, rolę Brevo oraz sposób odpowiadania klientom. Główna implementacja znajduje się w `api/contact.js`.

## Cel rozwiązania

Po prawidłowym wysłaniu formularza system tworzy dwie niezależne wiadomości:

1. pełne enquiry wysyłane do właściciela strony;
2. automatyczne potwierdzenie wysyłane do klienta.

Właściciel odpowiada klientowi natywnym przyciskiem **Reply** w Outlooku lub innym programie pocztowym. Adres klienta jest wybierany na podstawie nagłówka `Reply-To` ustawionego przez backend.

System celowo nie generuje osobnej odpowiedzi przez link `mailto:`.

## Elementy przepływu

### Formularz w przeglądarce

Formularze znajdują się na kilku stronach w katalogu `public/` i wysyłają dane do:

```text
POST /api/contact?redirect=/form-submitted.html
```

Plik `public/js/contact.js`:

- odczytuje wartości pól przez `FormData`;
- normalizuje dane do obiektu JSON;
- przeprowadza walidację po stronie przeglądarki;
- wysyła formularz przez `fetch`;
- blokuje kolejne kliknięcia i nadaje wysyłce identyfikator idempotency;
- po sukcesie przekierowuje użytkownika do `/form-submitted.html`.

Bez JavaScript formularz może zostać wysłany jako klasyczny `application/x-www-form-urlencoded`. Backend obsługuje oba formaty.

### Backend

Handler `api/contact.js` przyjmuje wyłącznie żądania `POST`. Backend ponownie odczytuje i waliduje dane, niezależnie od walidacji wykonanej w przeglądarce.

Sprawdzane są między innymi:

- imię i nazwisko;
- adres e-mail;
- numer telefonu;
- rodzaj okazji i rezerwacji;
- data wydarzenia;
- liczba wymaganych usług;
- lokalizacja;
- oczekiwana godzina gotowości;
- treść wiadomości.

Pole `company` / `hp_company` jest honeypotem. Jeżeli zostanie wypełnione przez automat, backend zwraca pozorny sukces bez wysyłania wiadomości.

Walidacja backendowa jest konieczna, ponieważ walidację JavaScript w przeglądarce można ominąć. W szczególności backend nie przyjmuje enquiry z pustą treścią.

## Wysyłka przez Brevo

Backend korzysta z Brevo Transactional Email API:

```text
POST https://api.brevo.com/v3/smtp/email
```

Zmienne środowiskowe używane przez mechanizm:

- `BREVO_API_KEY` — klucz API Brevo;
- `FROM_EMAIL` — zweryfikowany adres nadawcy używany przez Brevo;
- `OWNER_EMAIL` — skrzynka otrzymująca enquiry;
- `OWNER_NAME` — opcjonalna nazwa właściciela;
- `KV_REST_API_URL` i `KV_REST_API_TOKEN` (lub odpowiedniki `UPSTASH_REDIS_REST_*`) — trwały zapis i limity;
- `BREVO_WEBHOOK_SECRET` — wymagany tylko dla skonfigurowanego webhooka dostarczenia.

Każda wiadomość ma wersję HTML (`htmlContent`) oraz tekstową (`textContent`). Dzięki temu treść pozostaje czytelna także w programach pocztowych, które nie wyświetlają HTML.

Jeżeli skonfigurowano dane Redis, przed wysyłką poprawne enquiry jest zapisywane
w Upstash Redis na 365 dni. Zapis obejmuje treść formularza i osobne stany
wiadomości do właściciela oraz klienta. Bez Redis działa pamięć procesu, chyba
że `REQUIRE_DURABLE_CONTACT_STORAGE=true` wymusza trwały zapis.

Instrukcja otwierania historii w panelu, lista kluczy i komendy Redis znajdują
się w sekcji **View saved enquiry history in Upstash** w `docs/DEV.md`.

## Wiadomość do właściciela

Payload wysyłany do właściciela zawiera między innymi:

```js
{
  sender: {
    email: process.env.FROM_EMAIL,
    name: "Website Contact Form",
  },
  to: [{
    email: process.env.OWNER_EMAIL,
    name: process.env.OWNER_NAME || "Owner",
  }],
  replyTo: {
    email: email,
    name: name,
  },
  subject: `New enquiry: ${name}${occasion ? " – " + occasion : ""}`,
  htmlContent: ownerHtml,
  textContent: ownerText,
}
```

Nazwy `email` i `name` w `replyTo` odnoszą się do danych klienta pobranych z formularza.

Wiadomość zawiera wszystkie dane enquiry, w tym pełną treść pola z opisem planów klienta.

### Różnica między `From`, `To` i `Reply-To`

- `From` wskazuje zweryfikowanego nadawcę Brevo. Pozwala poprawnie wysłać i uwierzytelnić wiadomość dla SPF, DKIM i DMARC.
- `To` wskazuje skrzynkę właściciela, która ma otrzymać nowe enquiry.
- `Reply-To` wskazuje klienta, do którego ma zostać skierowana odpowiedź właściciela.

Nie należy ustawiać adresu klienta jako `From`. Wiadomość jest technicznie wysyłana przez system i domenę właściciela, a podszywanie się w polu `From` pod obcą domenę klienta mogłoby powodować problemy z uwierzytelnieniem i dostarczalnością.

## Jak odpowiadać klientowi

Prawidłowa procedura:

1. Otwórz wiadomość `New enquiry: ...` w Outlooku.
2. Użyj natywnego przycisku **Reply**.
3. Sprawdź, czy Outlook ustawił jako adresata e-mail klienta z formularza.
4. Napisz odpowiedź i wyślij ją normalnie z Outlooka.
5. Kolejne wiadomości obsługuj przez **Reply** w istniejącej korespondencji.

Po użyciu Reply program pocztowy odczytuje `Reply-To`, tworzy standardową wiadomość zwrotną i zarządza nagłówkami potrzebnymi do prezentowania konwersacji. Backend nie generuje ręcznie `In-Reply-To` ani `References`.

Pierwsza odpowiedź może być pokazana po stronie klienta jako początek nowej konwersacji, ponieważ klient nie otrzymał wewnętrznej wiadomości z formularza wysłanej do właściciela. Dalsza wymiana powinna być prowadzona natywnym Reply, aby programy pocztowe mogły grupować wiadomości w zwykły sposób.

## Dlaczego nie używamy `mailto:` do odpowiedzi

Poprzedni mechanizm zawierał przycisk „Reply to client”. Przycisk otwierał link `mailto:` z nową wiadomością i wstawiał tylko przygotowane powitanie, na przykład:

```text
Hi Emily Dolphin,
```

Nie była to prawdziwa odpowiedź na otrzymaną wiadomość. `mailto:` uruchamiał osobny szkic, nie korzystał z natywnego Reply klienta pocztowego i nie gwarantował zachowania struktury konwersacji. Szkic można było przypadkowo wysłać bez dopisania właściwej treści, przez co klient otrzymywał pustą lub prawie pustą wiadomość.

Z tego powodu z backendu usunięto:

- funkcję generującą `mailto:`;
- przygotowany subject i treść szkicu;
- link oraz przycisk „Reply to client”;
- tekstową wersję tego linku.

Wiadomość do właściciela zawiera teraz tylko informację:

```text
Use Reply in your email app to respond directly to the client.
```

W projekcie mogą pozostać zwykłe linki `mailto:hello@venus-hour.co.uk` w nawigacji lub stopce strony. Służą one odwiedzającym do rozpoczęcia bezpośredniego kontaktu i nie są częścią mechanizmu odpowiedzi na enquiry.

## Autoresponder klienta

Po zaakceptowaniu wiadomości do właściciela backend wysyła osobną wiadomość potwierdzającą na adres klienta. Autoresponder:

- potwierdza otrzymanie enquiry;
- informuje o przewidywanym czasie odpowiedzi;
- zawiera dane kontaktowe Venus Hour;
- nie zawiera sztucznego przycisku odpowiedzi na enquiry;
- ma `Reply-To` ustawione na `OWNER_EMAIL`, dlatego jego zwykła odpowiedź trafia do właściciela.

Adresatem autorespondera pozostaje klient; jego `Reply-To` kieruje odpowiedź do
skrzynki właściciela.

## Obsługa błędów

Najpierw wysyłana jest wiadomość do właściciela. Jeśli Brevo jej nie zaakceptuje, backend zwraca błąd i nie przechodzi do autorespondera.

Następnie wysyłany jest autoresponder klienta. Jeśli jego wysyłka się nie powiedzie, backend również zwraca błąd. Szczegóły błędów Brevo są zapisywane w logach serwera i nie są ujawniane przeglądarce.

Jeśli wiadomość właściciela została już zaakceptowana, ponowienie tego samego
zgłoszenia z tym samym identyfikatorem wysyła tylko brakujący autoresponder.
Frontend zachowuje ten identyfikator dla ponowienia w tej samej karcie.
Równoczesne kopie żądania są blokowane krótką blokadą w Redis lub pamięci
procesu.

Akceptacja API Brevo jest zapisywana jako `accepted`. Dopiero poprawnie
skonfigurowany endpoint `/api/brevo-webhook` aktualizuje ją później do
`delivered`, `deferred`, bounce, blocked albo error. Bez webhooka status
pozostaje `accepted` i finalny wynik należy sprawdzać w logach Brevo.

Po sukcesie żądanie AJAX otrzymuje JSON `{ ok: true }`, a klasyczne wysłanie formularza odpowiedź `303` prowadzącą do strony podziękowania.

## Limity i ochrona

- request formularza ma limit 24 KiB;
- wszystkie pola mają backendowe limity długości;
- limit wynosi 5 nowych zgłoszeń z IP i 3 z adresu e-mail na 15 minut;
- IP i e-mail w kluczach limitera są hashowane;
- przekierowanie może wskazywać tylko lokalną ścieżkę;
- timeout Brevo wynosi 8 sekund;
- automatycznie ponawiany jest tylko jednoznaczny błąd `429`, aby timeout nie tworzył duplikatów.

## Lista kontrolna po wdrożeniu

Po zmianie konfiguracji poczty lub wdrożeniu nowej wersji należy sprawdzić:

1. Formularz z prawidłowymi danymi kończy się stroną podziękowania.
2. Skrzynka `OWNER_EMAIL` otrzymuje pełne enquiry.
3. Źródło otrzymanej wiadomości zawiera `Reply-To` z dokładnym adresem klienta.
4. Natywne Reply w Outlooku ustawia klienta jako adresata.
5. Wiadomość do właściciela nie zawiera przycisku ani linku `mailto:` do odpowiedzi.
6. Klient otrzymuje osobny autoresponder.
7. SPF, DKIM i DMARC mają status PASS w nagłówkach otrzymanej wiadomości.
